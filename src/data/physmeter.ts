// Source: reference/VDM_Bench_Einsia (1).pdf, October 5, 2026 working draft.
// Keep provisional paper content here so future releases can update it separately.
export const paper = {
  name: "PhysMeter",
  subtitle: "Benchmarking Physical Consistency in Video World Models.",
  description: "A task-based benchmark that connects controlled video generation to observable physical constraints across mechanics, optics, electromagnetism, fluids, and thermal processes.",
  pdf: "/physmeter/paper-draft.pdf",
  date: "October 5, 2026",
};

export const domains = [
  { id: "mechanics", title: "Mechanics", icon: "pendulum", examples: "Motion · collisions · oscillations", description: "Track how objects move, interact, and settle under controlled initial conditions.", task: "Period–length relationship", criterion: "Compare two pendula under the same gravity: T₁²L₂ / (T₂²L₁) − 1 = 0." },
  { id: "optics", title: "Optics", icon: "rays", examples: "Reflection · refraction · projection", description: "Measure light paths and geometric relationships instead of relying on visual plausibility.", task: "Light reflection", criterion: "Compare incident and reflected angles relative to the surface normal." },
  { id: "electromagnetism", title: "Electromagnetism", icon: "field", examples: "Charges · magnetism · induction", description: "Observe the visible consequences of fields, currents, and induced interactions.", task: "Eddy-current braking", criterion: "Measure motion and damping in the task’s specified geometry and materials." },
  { id: "fluids", title: "Fluids & interfaces", icon: "water", examples: "Buoyancy · capillarity · viscous flow", description: "Recover boundaries, levels, and motion to test equilibrium and flow behavior.", task: "Communicating-vessel equilibrium", criterion: "Check whether connected liquid surfaces reach the same equilibrium height." },
  { id: "thermal", title: "Thermal processes", icon: "thermal", examples: "Melting · freezing · phase transitions", description: "Follow changes in state, volume, and event timing through the generated sequence.", task: "Water level during ice melting", criterion: "Track the water level as floating ice melts under the specified initial conditions." },
] as const;

export const pipeline = [
  { title: "Control the scene", text: "Construct and review a first frame with clear geometry, object identity, and initial conditions.", label: "First frame + prompt" },
  { title: "Generate the video", text: "Ask the model to continue the physical process while keeping the target outcome unspecified.", label: "Image-to-video model" },
  { title: "Measure observables", text: "After screening for temporal consistency, use task-specific tracking, segmentation, geometric fitting, and event detection.", label: "Trajectories · angles · events" },
  { title: "Check the constraints", text: "Combine observability and physics scores with the reviewed pass flag; report measurement evidence separately.", label: "Interpretable evaluation" },
];
