#!/usr/bin/env python3
"""
Transactional live publisher for OpenDistricts.

Goal:
- Validate a candidate version thoroughly.
- Auto-fix missing region anchors when possible.
- Update live dataset only if all checks pass.
- Keep live untouched on failure.

Usage:
  python scripts/publish_live_atomic.py --version v3
  python scripts/publish_live_atomic.py --version v3 --dry-run
  python scripts/publish_live_atomic.py --version v3 --allow-unknown-region
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from typing import Any, Dict, List, Optional, Tuple

REQUIRED_DATA_FILES = ["events.json", "districts.json", "states.json", "regions.json", "manifest.json"]
MANIFEST_HASH_FILES = ["events.json", "districts.json", "states.json", "regions.json"]
VALID_CATEGORIES = {"health", "infrastructure", "mobility", "safety", "weather", "emergency"}
VALID_IMPACT_SCALES = {"POINT", "LOCAL", "WIDE", "STATE"}
VALID_RENDER_AS = {"marker", "multi_marker", "radial", "diffusion", "hotspot", "corridor", "polygon_fill"}


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _compute_manifest_hash(dataset_dir: Path) -> str:
    combined = ""
    for name in MANIFEST_HASH_FILES:
        file_path = dataset_dir / name
        if not file_path.exists():
            raise FileNotFoundError(f"Missing file for hash computation: {file_path}")
        with file_path.open("rb") as f:
            combined += _sha256_bytes(f.read())
    return _sha256_bytes(combined.encode("utf-8"))


def _point_in_ring(lng: float, lat: float, ring: List[List[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = float(ring[i][0]), float(ring[i][1])
        xj, yj = float(ring[j][0]), float(ring[j][1])
        intersects = ((yi > lat) != (yj > lat)) and (
            lng < ((xj - xi) * (lat - yi)) / ((yj - yi) if (yj - yi) != 0 else 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_in_polygon_with_holes(lng: float, lat: float, polygon_rings: List[List[List[float]]]) -> bool:
    if not polygon_rings:
        return False
    outer = polygon_rings[0]
    holes = polygon_rings[1:]
    if not outer or not _point_in_ring(lng, lat, outer):
        return False
    for hole in holes:
        if hole and _point_in_ring(lng, lat, hole):
            return False
    return True


def _point_in_geometry(lng: float, lat: float, geometry: Dict[str, Any]) -> bool:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "Polygon":
        return _point_in_polygon_with_holes(lng, lat, coords or [])
    if gtype == "MultiPolygon":
        return any(_point_in_polygon_with_holes(lng, lat, poly) for poly in (coords or []))
    return False


def _collect_coords(geometry: Dict[str, Any]) -> List[Tuple[float, float]]:
    out: List[Tuple[float, float]] = []
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "Polygon":
        for ring in coords or []:
            for p in ring:
                if isinstance(p, list) and len(p) >= 2:
                    out.append((float(p[0]), float(p[1])))
    elif gtype == "MultiPolygon":
        for poly in coords or []:
            for ring in poly:
                for p in ring:
                    if isinstance(p, list) and len(p) >= 2:
                        out.append((float(p[0]), float(p[1])))
    return out


def _bbox_centroid(geometry: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    pts = _collect_coords(geometry)
    if not pts:
        return None
    lngs = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    return ((min(lngs) + max(lngs)) / 2.0, (min(lats) + max(lats)) / 2.0)


def _load_region_features(
    data_dir: Path,
    state_id: str,
    district_id: str,
    cache: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    key = f"{state_id}:{district_id}"
    if key in cache:
        return cache[key]

    geo_path = data_dir / "geo" / state_id / f"{district_id}.geojson"
    if not geo_path.exists():
        cache[key] = []
        return []

    try:
        fc = _read_json(geo_path)
    except Exception:
        cache[key] = []
        return []

    features: List[Dict[str, Any]] = []
    for f in fc.get("features", []) if isinstance(fc, dict) else []:
        props = f.get("properties", {}) if isinstance(f, dict) else {}
        region_id = props.get("id") if isinstance(props, dict) else None
        geom = f.get("geometry") if isinstance(f, dict) else None
        if isinstance(region_id, str) and isinstance(geom, dict):
            features.append({
                "id": region_id,
                "geometry": geom,
                "centroid": _bbox_centroid(geom),
            })

    cache[key] = features
    return features


def _resolve_region_id(
    data_dir: Path,
    state_id: str,
    district_id: str,
    lat: float,
    lng: float,
    cache: Dict[str, List[Dict[str, Any]]],
) -> Optional[str]:
    features = _load_region_features(data_dir, state_id, district_id, cache)
    if not features:
        return None

    for f in features:
        if _point_in_geometry(lng, lat, f["geometry"]):
            return f["id"]

    best_id: Optional[str] = None
    best_dist = float("inf")
    for f in features:
        centroid = f.get("centroid")
        if not centroid:
            continue
        c_lng, c_lat = centroid
        d2 = (lng - c_lng) ** 2 + (lat - c_lat) ** 2
        if d2 < best_dist:
            best_dist = d2
            best_id = f["id"]
    return best_id


def _add_point(points: List[Tuple[str, float, float]], src: str, point: Any) -> None:
    if not isinstance(point, dict):
        return
    lat = point.get("lat")
    lng = point.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        points.append((src, float(lat), float(lng)))


def _event_points(evt: Dict[str, Any]) -> List[Tuple[str, float, float]]:
    points: List[Tuple[str, float, float]] = []
    _add_point(points, "geoPoint", evt.get("geoPoint"))

    meta = evt.get("meta") if isinstance(evt.get("meta"), dict) else {}
    for key in ("pathCoords", "multiPoints", "heatPoints", "clusterPoints"):
        arr = meta.get(key)
        if isinstance(arr, list):
            for p in arr:
                _add_point(points, key, p)
    return points


def _normalize_region_fields(evt: Dict[str, Any]) -> None:
    region_ids = evt.get("regionIds")
    if isinstance(region_ids, list):
        clean: List[str] = []
        seen = set()
        for rid in region_ids:
            if isinstance(rid, str):
                item = rid.strip()
                if item and item not in seen:
                    seen.add(item)
                    clean.append(item)
        evt["regionIds"] = clean

    rid = evt.get("regionId")
    if (not isinstance(rid, str) or not rid.strip()) and isinstance(evt.get("regionIds"), list) and evt["regionIds"]:
        evt["regionId"] = evt["regionIds"][0]

    if evt.get("spansMultipleRegions") is None and isinstance(evt.get("regionIds"), list) and len(evt["regionIds"]) > 1:
        evt["spansMultipleRegions"] = True


def _autofix_region_anchor(
    evt: Dict[str, Any],
    data_dir: Path,
    cache: Dict[str, List[Dict[str, Any]]],
) -> bool:
    if isinstance(evt.get("regionId"), str) and evt["regionId"].strip():
        return False

    state_id = evt.get("stateId")
    district_id = evt.get("districtId")
    if not isinstance(state_id, str) or not isinstance(district_id, str):
        return False

    points = _event_points(evt)
    if not points:
        return False

    anchor: Optional[Tuple[str, float, float]] = None
    for preferred in ("geoPoint", "pathCoords", "multiPoints", "heatPoints", "clusterPoints"):
        anchor = next((p for p in points if p[0] == preferred), None)
        if anchor:
            break
    if not anchor:
        anchor = points[0]

    resolved_ids: List[str] = []
    for _, lat, lng in points:
        rid = _resolve_region_id(data_dir, state_id, district_id, lat, lng, cache)
        if rid:
            resolved_ids.append(rid)

    anchor_region = _resolve_region_id(data_dir, state_id, district_id, anchor[1], anchor[2], cache)
    if not anchor_region and resolved_ids:
        anchor_region = resolved_ids[0]
    if not anchor_region:
        return False

    existing_region_ids = evt.get("regionIds") if isinstance(evt.get("regionIds"), list) else []
    merged = [anchor_region] + [x for x in existing_region_ids if isinstance(x, str)] + resolved_ids
    deduped: List[str] = []
    seen = set()
    for item in merged:
        token = item.strip()
        if token and token not in seen:
            seen.add(token)
            deduped.append(token)

    evt["regionId"] = anchor_region
    evt["regionIds"] = deduped
    if len(deduped) > 1:
        evt["spansMultipleRegions"] = True
    return True


def _validate_dataset(
    data_dir: Path,
    events: List[Dict[str, Any]],
    districts: List[Dict[str, Any]],
    *,
    strict_unknown_region: bool,
) -> Tuple[List[str], List[str], int]:
    errors: List[str] = []
    warnings: List[str] = []
    auto_fixed = 0

    district_ids = {d.get("id") for d in districts if isinstance(d, dict) and isinstance(d.get("id"), str)}
    region_geo_cache: Dict[str, List[Dict[str, Any]]] = {}

    for idx, evt in enumerate(events):
        if not isinstance(evt, dict):
            errors.append(f"index:{idx}: event is not an object")
            continue

        event_id = evt.get("id") if isinstance(evt.get("id"), str) else f"index:{idx}"

        if _autofix_region_anchor(evt, data_dir, region_geo_cache):
            auto_fixed += 1

        _normalize_region_fields(evt)

        if not isinstance(evt.get("id"), str) or not evt.get("id"):
            errors.append(f"{event_id}: missing or invalid id")
        if not isinstance(evt.get("stateId"), str) or not evt.get("stateId"):
            errors.append(f"{event_id}: missing or invalid stateId")
        if not isinstance(evt.get("districtId"), str) or not evt.get("districtId"):
            errors.append(f"{event_id}: missing or invalid districtId")

        if evt.get("districtId") not in district_ids:
            errors.append(f"{event_id}: districtId '{evt.get('districtId')}' is not registered in districts.json")

        category = evt.get("category")
        if category is not None and category not in VALID_CATEGORIES:
            warnings.append(
                f"{event_id}: non-standard category '{category}' (allowed set: {sorted(VALID_CATEGORIES)})"
            )

        impact = evt.get("impactScale")
        if impact is not None and impact not in VALID_IMPACT_SCALES:
            warnings.append(
                f"{event_id}: non-standard impactScale '{impact}' (allowed set: {sorted(VALID_IMPACT_SCALES)})"
            )

        render_as = evt.get("renderAs")
        if render_as is not None and render_as not in VALID_RENDER_AS:
            warnings.append(
                f"{event_id}: non-standard renderAs '{render_as}' (allowed set: {sorted(VALID_RENDER_AS)})"
            )

        timestamp = evt.get("timestamp")
        if isinstance(timestamp, str):
            try:
                dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except Exception:
                warnings.append(f"{event_id}: timestamp is not valid ISO-8601")

        expires_at = evt.get("expiresAt")
        if expires_at is not None and isinstance(expires_at, str):
            try:
                dt.datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            except Exception:
                warnings.append(f"{event_id}: expiresAt is not valid ISO-8601")

        geo = evt.get("geoPoint")
        if geo is not None:
            if not isinstance(geo, dict) or not isinstance(geo.get("lat"), (int, float)) or not isinstance(geo.get("lng"), (int, float)):
                errors.append(f"{event_id}: geoPoint must be {{lat:number,lng:number}} when provided")

        rid = evt.get("regionId")
        if rid == "pending":
            errors.append(f"{event_id}: regionId cannot be 'pending'")
        if rid is not None and not isinstance(rid, str):
            errors.append(f"{event_id}: regionId must be string or null")
        if isinstance(rid, str) and not rid.strip():
            errors.append(f"{event_id}: regionId cannot be empty string")

        region_ids = evt.get("regionIds")
        unique_region_ids: List[str] = []
        if region_ids is not None:
            if not isinstance(region_ids, list):
                errors.append(f"{event_id}: regionIds must be an array when provided")
            else:
                seen = set()
                for i, item in enumerate(region_ids):
                    if not isinstance(item, str) or not item.strip():
                        errors.append(f"{event_id}: regionIds[{i}] must be a non-empty string")
                        continue
                    clean = item.strip()
                    if clean == "pending":
                        errors.append(f"{event_id}: regionIds[{i}] cannot be 'pending'")
                        continue
                    if clean in seen:
                        warnings.append(f"{event_id}: regionIds contains duplicate value '{clean}'")
                        continue
                    seen.add(clean)
                    unique_region_ids.append(clean)

        has_primary_region = isinstance(evt.get("regionId"), str) and bool(evt["regionId"].strip())
        has_region_ids = len(unique_region_ids) > 0
        has_region_anchor = has_primary_region or has_region_ids

        spans_multiple = evt.get("spansMultipleRegions")
        if spans_multiple is not None and not isinstance(spans_multiple, bool):
            errors.append(f"{event_id}: spansMultipleRegions must be boolean when provided")
        if spans_multiple is True and len(unique_region_ids) < 2:
            warnings.append(f"{event_id}: spansMultipleRegions=true but regionIds has fewer than 2 regions")

        if evt.get("renderAs") == "polygon_fill" and not has_region_anchor:
            errors.append(f"{event_id}: polygon_fill requires regionId or regionIds[]")

        meta = evt.get("meta") if isinstance(evt.get("meta"), dict) else {}
        has_path = isinstance(meta.get("pathCoords"), list) and len(meta.get("pathCoords")) > 0
        if evt.get("renderAs") == "corridor" and has_path and not has_region_anchor:
            errors.append(f"{event_id}: corridor has pathCoords but no region anchor")

        has_geometry_hint = len(_event_points(evt)) > 0
        if not has_region_anchor and has_geometry_hint:
            msg = f"{event_id}: missing regionId/regionIds despite available geometry hints"
            if strict_unknown_region:
                errors.append(msg)
            else:
                warnings.append(msg)

    return errors, warnings, auto_fixed


def _validate_district_geojson_files(repo_root: Path, districts: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    for d in districts:
        if not isinstance(d, dict):
            continue
        district_id = d.get("id", "<unknown>")
        url = d.get("geoJsonUrl")
        if not isinstance(url, str) or not url.strip():
            errors.append(f"district '{district_id}': missing geoJsonUrl")
            continue

        clean = url.split("?")[0].strip()
        while clean.startswith("./"):
            clean = clean[2:]

        full = repo_root / clean
        if not full.exists():
            errors.append(f"district '{district_id}': geoJsonUrl target missing -> {clean}")
    return errors


def _reconcile_district_geojson_files(
    repo_root: Path,
    districts: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    used_district_ids = {
        e.get("districtId")
        for e in events
        if isinstance(e, dict) and isinstance(e.get("districtId"), str)
    }

    kept: List[Dict[str, Any]] = []
    removed: List[str] = []
    errors: List[str] = []

    for d in districts:
        if not isinstance(d, dict):
            continue

        district_id = str(d.get("id", "<unknown>"))
        url = d.get("geoJsonUrl")
        if not isinstance(url, str) or not url.strip():
            if district_id in used_district_ids:
                errors.append(f"district '{district_id}': missing geoJsonUrl (district is referenced by events)")
            else:
                removed.append(district_id)
            continue

        clean = url.split("?")[0].strip()
        while clean.startswith("./"):
            clean = clean[2:]

        full = repo_root / clean
        if full.exists():
            kept.append(d)
            continue

        if district_id in used_district_ids:
            errors.append(f"district '{district_id}': geoJsonUrl target missing -> {clean}")
        else:
            removed.append(district_id)

    return kept, errors, removed


def _ensure_required_files(version_dir: Path) -> List[str]:
    missing = []
    for name in REQUIRED_DATA_FILES:
        if not (version_dir / name).exists():
            missing.append(name)
    return missing


def _copy_dir_contents(src: Path, dst: Path) -> None:
    for child in src.iterdir():
        target = dst / child.name
        if child.is_dir():
            shutil.copytree(child, target)
        else:
            shutil.copy2(child, target)


def _safe_history_target(history_dir: Path, current_version: str) -> Path:
    stamp = dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    base = history_dir / f"history-{current_version}-{stamp}"
    if not base.exists():
        return base
    i = 1
    while True:
        alt = history_dir / f"history-{current_version}-{stamp}-{i}"
        if not alt.exists():
            return alt
        i += 1


def _atomic_swap_live(data_dir: Path, stage_dir: Path) -> Tuple[Optional[Path], Path]:
    live_dir = data_dir / "live"
    history_dir = data_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)

    current_version = "unknown"
    if (live_dir / "manifest.json").exists():
        try:
            live_manifest = _read_json(live_dir / "manifest.json")
            current_version = str(live_manifest.get("datasetVersion") or "unknown")
        except Exception:
            current_version = "unknown"

    history_target: Optional[Path] = None
    moved_live = False

    try:
        if live_dir.exists():
            history_target = _safe_history_target(history_dir, current_version)
            live_dir.rename(history_target)
            moved_live = True

        stage_dir.rename(live_dir)
        return history_target, live_dir
    except Exception:
        if moved_live and history_target and history_target.exists() and not live_dir.exists():
            history_target.rename(live_dir)
        raise


def run(args: argparse.Namespace) -> int:
    script_path = Path(__file__).resolve()
    repo_root = script_path.parent.parent
    data_dir = repo_root / "data"
    versions_dir = data_dir / "versions"
    version_dir = versions_dir / args.version

    if not version_dir.exists():
        print(f"ERROR: version folder not found: {version_dir}", file=sys.stderr)
        return 2

    missing_files = _ensure_required_files(version_dir)
    if missing_files:
        print("ERROR: missing required dataset files:", file=sys.stderr)
        for name in missing_files:
            print(f"  - {name}", file=sys.stderr)
        return 2

    stage_root = Path(tempfile.mkdtemp(prefix="_live_stage_", dir=str(data_dir)))
    stage_dir = stage_root / args.version
    stage_dir.mkdir(parents=True, exist_ok=True)

    try:
        _copy_dir_contents(version_dir, stage_dir)

        events = _read_json(stage_dir / "events.json")
        districts = _read_json(stage_dir / "districts.json")
        states = _read_json(stage_dir / "states.json")
        regions = _read_json(stage_dir / "regions.json")
        manifest = _read_json(stage_dir / "manifest.json")

        if not isinstance(events, list):
            print("ERROR: events.json must be an array", file=sys.stderr)
            return 2
        if not isinstance(districts, list):
            print("ERROR: districts.json must be an array", file=sys.stderr)
            return 2
        if not isinstance(states, list):
            print("ERROR: states.json must be an array", file=sys.stderr)
            return 2
        if not isinstance(regions, (dict, list)):
            print("ERROR: regions.json must be an object or array", file=sys.stderr)
            return 2
        if not isinstance(manifest, dict):
            print("ERROR: manifest.json must be an object", file=sys.stderr)
            return 2

        original_events = copy.deepcopy(events)
        original_districts = copy.deepcopy(districts)

        districts, district_errors, removed_districts = _reconcile_district_geojson_files(repo_root, districts, events)

        errors, warnings, auto_fixed = _validate_dataset(
            data_dir,
            events,
            districts,
            strict_unknown_region=not args.allow_unknown_region,
        )

        errors.extend(district_errors)

        if errors:
            print("\nBLOCKED: candidate dataset failed checks. Live remains untouched.", file=sys.stderr)
            print(f"Errors ({len(errors)}):", file=sys.stderr)
            for msg in errors:
                print(f"  - {msg}", file=sys.stderr)
            if warnings:
                print(f"Warnings ({len(warnings)}):")
                for msg in warnings:
                    print(f"  - {msg}")
            return 1

        if events != original_events:
            _write_json(stage_dir / "events.json", events)
        if districts != original_districts:
            _write_json(stage_dir / "districts.json", districts)

        manifest["counts"] = {
            "events": len(events),
            "districts": len(districts),
            "states": len(states),
        }
        manifest["datasetVersion"] = args.version
        manifest["hash"] = _compute_manifest_hash(stage_dir)
        _write_json(stage_dir / "manifest.json", manifest)

        print("\nPreflight passed.")
        print(f"  Version: {args.version}")
        print(f"  Events: {len(events)}")
        print(f"  Auto-fixed region anchors: {auto_fixed}")
        if removed_districts:
            print(f"  Removed stale districts without geojson and without events: {len(removed_districts)}")
        print(f"  Warnings: {len(warnings)}")
        print(f"  Computed manifest hash: {manifest['hash']}")

        if warnings:
            print("  Warning details:")
            for msg in warnings:
                print(f"    - {msg}")

        if args.dry_run:
            print("\nDry run only. Live data was not modified.")
            return 0

        history_target, live_dir = _atomic_swap_live(data_dir, stage_dir)

        for name in REQUIRED_DATA_FILES:
            shutil.copy2(live_dir / name, version_dir / name)

        print("\nPublish succeeded.")
        if history_target:
            print(f"  Previous live moved to: {history_target.relative_to(repo_root)}")
        print(f"  New live source: {live_dir.relative_to(repo_root)}")
        print(f"  Version synchronized: {version_dir.relative_to(repo_root)}")
        return 0

    except Exception as ex:
        print("\nERROR: publish failed. Live dataset was not updated.", file=sys.stderr)
        print(f"Reason: {ex}", file=sys.stderr)
        return 1
    finally:
        try:
            if stage_root.exists():
                shutil.rmtree(stage_root, ignore_errors=True)
        except Exception:
            pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Atomic live publisher with strict preflight checks and optional auto-anchor backfill."
    )
    parser.add_argument("--version", required=True, help="Version folder name under data/versions (example: v3)")
    parser.add_argument("--dry-run", action="store_true", help="Run all checks and fixes but do not modify live")
    parser.add_argument(
        "--allow-unknown-region",
        action="store_true",
        help="Do not fail if an event has no region anchor after autofix attempts",
    )
    return parser


if __name__ == "__main__":
    cli_parser = build_parser()
    exit_code = run(cli_parser.parse_args())
    sys.exit(exit_code)
