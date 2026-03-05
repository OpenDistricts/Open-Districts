export function detectAdvancedEffectsSupport() {
    const capability = {
        hasWebGL2: false,
        hasWebGL1: false,
        has2D: false,
        deckGlobal: !!window?.deck,
        pixiGlobal: !!window?.PIXI,
        webgl: false,
        canvas2d: false,
        supported: false,
    };
    try {
        const canvas = document.createElement("canvas");
        capability.hasWebGL2 = !!canvas.getContext("webgl2");
        capability.hasWebGL1 = !!canvas.getContext("webgl");
        capability.has2D = !!canvas.getContext("2d");
        capability.webgl = capability.hasWebGL2 || capability.hasWebGL1;
        capability.canvas2d = capability.has2D;
        capability.supported = capability.webgl || capability.canvas2d;
    } catch (_) {
        // Leave defaults.
    }
    return capability;
}
