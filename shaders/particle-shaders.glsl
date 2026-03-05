#shader-set diffusion-particles

// Vertex shader (reference only in v1; sprite batching is currently used)
// Inputs:
//   a_position: vec2 particle local offset
//   a_center: vec2 projected map center
//   a_size: float particle size
//
// gl_Position = projectionMatrix * vec4(a_center + a_position, 0.0, 1.0);

// Fragment shader (reference only in v1)
// Inputs:
//   v_distanceNorm: float normalized distance from plume center [0..1]
//
// opacity = exp(-v_distanceNorm);
// color = mix(vec3(0.96, 0.86, 0.57), vec3(0.54, 0.46, 0.29), v_distanceNorm);

