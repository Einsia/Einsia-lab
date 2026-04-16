/**
 * Task descriptions for Frontier-Engineering Bench (English only)
 */
window.TASK_DESCRIPTIONS = {

  // ── 1. Astrodynamics ─────────────────────────────────────────────────────────
  'MannedLunarLanding': {
    en: 'This benchmark targets soft-landing trajectory optimization for a crewed lunar lander under thrust limits, propellant use, and dynamical/path constraints. The goal is a feasible trajectory from orbit to terminal conditions that lands safely while saving fuel where possible. Evaluation stresses nonlinear optimal control, constraint satisfaction, and terminal accuracy—typical of real astrodynamics optimization.'
  },

  // ── 2–4. Kernel Engineering ──────────────────────────────────────────────────
  'MLA': {
    en: 'This task focuses on implementing and tuning a multi-head attention–style (MLA) GPU kernel for correctness and strong throughput or latency on the target device. It exercises memory coalescing, register/shared-memory pressure, and launch configuration. The scorer combines numerical checks with performance metrics, reflecting operator-level HPC engineering.'
  },
  'TriMul': {
    en: 'This benchmark asks for a high-performance TriMul-style GPU kernel under strict correctness, trading off tiling, layout, and occupancy—often VRAM-bound on consumer GPUs. Evaluation runs representative workloads and scores both accuracy and speed against the benchmark\'s reference, highlighting specialized GEMM-like kernel engineering.'
  },
  'FlashAttention': {
    en: 'Optimize a causal scaled dot-product attention forward kernel (FlashAttention-style) for GPU execution while matching a reference numerically. The problem stresses tiled online softmax and memory locality. Scoring reports speed and correctness for fixed shapes, representing bandwidth-bound attention kernel work in production ML stacks.'
  },

  // ── 5. Single Cell Analysis ───────────────────────────────────────────────────
  'predict_modality': {
    en: 'Predict surface-protein (ADT) modalities from single-cell RNA profiles in an Open Problems–style setup. Models must generalize under biological noise and are scored by benchmark-defined global and stratified metrics. It reflects multimodal integration in single-cell analysis.'
  },

  // ── 6–8. Quantum Computing ──────────────────────────────────────────────────
  'task_01_routing_qftentangled': {
    en: 'Routing-oriented compilation for entangled QFT-style circuits: assign SWAP insertions and mapping under a coupling graph and gate set to minimize depth or a noise-aware cost. It mixes discrete layout choices with compilation objectives found in near-term superconducting processors.'
  },
  'task_02_clifford_t_synthesis': {
    en: 'Clifford+T synthesis: realize a target unitary or subcircuit with fewer T gates, lower T-depth, or cheaper total gate count. The benchmark scores against reference costs relevant to fault-tolerant quantum computing, emphasizing circuit rewriting and combinatorial optimization in QC toolchains.'
  },
  'task_03_cross_target_qaoa': {
    en: 'Cross-target robust optimization for QAOA-style variational parameters across instances or perturbations, improving mean or worst-case objective values. It captures robustness needs for VQAs when problem instances or noise conditions shift—an engineering angle on quantum heuristic performance.'
  },

  // ── 9–11. Cryptographic ─────────────────────────────────────────────────────
  'crypto_aes128': {
    en: 'Optimize a software AES-128 CTR implementation for throughput/latency while preserving standard-compliant I/O and functional correctness on test vectors. It mirrors cryptographic engineering trade-offs between table lookups, SIMD, and side-channel-aware design where applicable.'
  },
  'crypto_sha256': {
    en: 'Implement or tune the SHA-256 compression function for speed on representative message lengths with bit-exact agreement on standard vectors. The task stresses bitwise rounds, unrolling, and memory behavior—typical hash primitive optimization in TLS and blockchain stacks.'
  },
  'crypto_sha3_256': {
    en: 'Accelerate a SHA3-256 (Keccak sponge) implementation while preserving correct Keccak-f permutations and sponge semantics on test vectors. It differs structurally from SHA-256 and highlights optimization of the round function and state layout for modern CPUs.'
  },

  // ── 12–13. Energy Storage ───────────────────────────────────────────────────
  'BatteryFastChargingProfile': {
    en: 'Optimize time-varying fast-charge current profiles for a Li-ion cell under voltage, thermal, and degradation-style constraints to reduce charge time while limiting aging risk. It couples optimal control with reduced electrochemical models and scores constraint slack versus charging objectives.'
  },
  'BatteryFastChargingSPMe': {
    en: 'Staged fast-charge optimization under a reduced SPMe-T-Aging–style coupled electrochemical, thermal, and aging model, including proxies for plating and fade. It is more physics-heavy than profile-only tasks and scores feasible trajectories against composite objectives for BMS-oriented algorithms.'
  },

  // ── 14. Sustainable Data Center Control ─────────────────────────────────────
  'hand_written_control': {
    en: 'A SustainDC joint-control benchmark coordinating load shifting, cooling, and battery dispatch to reduce energy cost or carbon while meeting SLA-style constraints. Large coupled state and multi-objective trade-offs reflect real sustainable datacenter operations, evaluated through the unified pipeline.'
  },

  // ── 15–17. Reaction Optimisation ─────────────────────────────────────────────
  'snar_multiobjective': {
    en: 'Multi-objective optimization of a continuous-flow SnAr reaction, trading productivity against waste or byproduct metrics along a Pareto front over continuous operating variables. Grounded in chemical engineering emulators (SUMMIT family), it reflects real plant trade-offs among yield, waste, and operability.'
  },
  'mit_case1_mixed': {
    en: 'Mixed-variable reaction yield optimization from the MIT_case1 setting: continuous process variables plus a categorical catalyst choice. It stresses black-box optimization with discrete decisions, evaluated via the benchmark\'s unified hook into SUMMIT-style verification—common in digital-twin reaction tuning.'
  },
  'reizman_suzuki_pareto': {
    en: 'Pareto optimization on the Reizman Suzuki emulator over catalyst choice and continuous conditions to improve conflicting chemical metrics. Multi-objective black-box search under chemistry-side constraints is scored through the benchmark\'s evaluator, mirroring co-design of recipe and operating point.'
  },

  // ── 18–19. Optics / Adaptive ───────────────────────────────────────────────
  'adaptive_temporal_smooth_control': {
    en: 'Adaptive optics control balancing temporal smoothness of DM commands against correction quality—reducing high-frequency actuator chatter while tracking wavefront error. Optimizing control time series reflects temporal constraints in closed-loop AO hardware.'
  },
  'adaptive_fault_tolerant_fusion': {
    en: 'Fault-tolerant fusion across multiple wavefront sensors when some channels fail or degrade, maintaining reliable wavefront estimates and correction commands. Scoring uses synthetic fault patterns, reflecting availability requirements in multi-WFS AO systems.'
  },

  // ── 20–26. Optics / Fiber & Holographic ─────────────────────────────────────
  'phase_fourier_pattern_holography': {
    en: 'Fourier-domain phase holography: optimize a phase plate so propagated intensity matches a target pattern for beam shaping or splitting. Pixelized phase under physical propagation models links to phase-retrieval-style engineering with scored intensity error or efficiency metrics.'
  },
  'phase_dammann_uniform_orders': {
    en: 'Dammann-grating-style phase design for uniform power across selected diffraction orders used in array illumination. Phase profiles must respect periodicity and fabrication quantization; scoring targets order uniformity and stray zero-order leakage—classic binary optics engineering.'
  },
  'fiber_wdm_channel_power_allocation': {
    en: 'Joint WDM channel and launch-power allocation under nonlinear crosstalk, amplifier gain ripple, and OSNR limits to maximize capacity or minimize error-related cost. Continuous power vectors reflect physical-layer networking optimization scored by link simulation outputs.'
  },
  'fiber_mcs_power_scheduling': {
    en: 'Joint MCS and transmit-power scheduling for optical links under time-varying channels or traffic, choosing discrete modulation orders and power levels subject to BLER or latency constraints. Mixed discrete–continuous control mirrors link adaptation in optical access and coherent systems.'
  },
  'fiber_guardband_spectrum_packing': {
    en: 'Spectrum packing with guard-band and filter roll-off constraints—placing channels to maximize throughput while limiting adjacent-channel interference. Combines combinatorial placement with continuous spacing, scored by interference-aware capacity metrics from simulation.'
  },
  'holographic_multifocus_power_ratio': {
    en: 'Holographic multi-focus power-ratio control: allocate target intensity shares across foci while suppressing background and crosstalk. Phase optimization under propagation physics supports optical tweezers or parallel micromachining, scored by ratio error and uniformity metrics.'
  },
  'holographic_multiplane_focusing': {
    en: 'Multi-plane holographic focusing to create focal arrays at several depths or lateral planes for 3D excitation or volumetric display segments. Trade-offs include inter-plane crosstalk and diffraction efficiency; scoring measures per-plane target fidelity versus simulated intensity.'
  },

  // ── 27. Computer Systems ─────────────────────────────────────────────────────
  'MallocLab': {
    en: 'The CSAPP-style Malloc Lab: implement `malloc`/`free`/`realloc` in a constrained region to maximize utilization and throughput on realistic allocation traces. It exercises segregated lists, coalescing, and throughput-oriented heuristics, scored by an mdriver-like harness for correctness and performance.'
  },

  // ── 28. EngDesign ───────────────────────────────────────────────────────────
  'EngDesign': {
    en: 'A bundle of EngDesign-sourced engineering cases (CY_03, WJ_01, XY_05, AM_02, AM_03, YJ_02, YJ_03) evaluated through Docker-backed scripts and per-case rubrics spanning structural, topology, and related design tasks. In the v1 pool it counts as one benchmark family though multiple distinct problem providers exist; use `task=engdesign` per the domain README.'
  },

  // ── 29–33. Inventory Optimization ─────────────────────────────────────────
  'tree_gsm_safety_stock': {
    en: 'Tree-structured multi-echelon safety-stock placement under guaranteed-service–style assumptions: choose safety stocks or coverage times per node to meet service targets while minimizing system-wide holding cost—classic supply-chain network inventory optimization.'
  },
  'general_meio': {
    en: 'General-topology multi-echelon inventory optimization (MEIO) with simulation-based expected cost objectives over stochastic demand, possibly including non-tree networks. Policy search targets base-stock–like parameters under sample-path evaluation—realistic MEIO engineering beyond trees.'
  },
  'joint_replenishment': {
    en: 'Multi-SKU joint replenishment with shared setup or truck costs: choose lot sizes and timings to trade holding versus stockout under stochastic or deterministic demand. Mixed structure reflects retail distribution "order pooling" combinatorics scored by total cost or service level.'
  },
  'finite_horizon_dp': {
    en: 'Finite-horizon stochastic inventory control via time-varying policies minimizing discounted or total expected cost over a known horizon. State may include on-hand inventory and information delays; scoring rolls out costs and constraint violations—typical for promotional or seasonal planning.'
  },
  'disruption_eoqd': {
    en: 'EOQ-style lot-sizing under supply disruptions: optimize order quantities and reorder points when supply availability is stochastic, minimizing long-run expected cost blending holding, shortage, and ordering. It extends classical EOQ with resilience-motivated uncertainty modeling.'
  },

  // ── 34. PyPortfolioOpt ───────────────────────────────────────────────────────
  'robust_mvo_rebalance': {
    en: 'Robust mean-variance portfolio rebalancing under estimation uncertainty plus sector/factor/turnover constraints to improve out-of-sample or worst-case risk-return trade-offs. Convex robustification meets practical trading limits; scoring uses benchmark return/covariance data and constraint slacks.'
  },

  // ── 35–37. JobShop ──────────────────────────────────────────────────────────
  'abz': {
    en: 'Classical job-shop scheduling on the ABZ benchmark family (Adams, Balas, Zawack 1988): sequence operations on machines to minimize makespan or tardiness—strongly NP-hard combinatorial optimization. Scoring compares against published bounds/optima for relative gap, a core manufacturing scheduling challenge.'
  },
  'swv': {
    en: 'JSSP on the SWV family (Storer, Wu, Vaccari 1992): another standard suite stressing algorithm robustness across shop layouts and sizes. Encodings range from permutations to time-indexed MILP; scoring references published best-known values for optimality gaps.'
  },
  'ta': {
    en: 'JSSP on Taillard\'s TA family—large, widely used instances for makespan minimization that stress heuristics and parallel search at scale. Scoring against Taillard best-known solutions benchmarks industrial-grade job-shop solvers.'
  },

  // ── 38–40. Structural Optimization ─────────────────────────────────────────
  'ISCSO2015': {
    en: 'ISCSO 2015–style 45-bar 2D truss sizing and shape optimization under stress, displacement, and volume constraints to minimize mass or compliance. FEM-linked black-box evaluation reflects automated conceptual structural design in civil engineering competitions.'
  },
  'ISCSO2023': {
    en: 'ISCSO 2023 large 3D truss (~284 members) sizing under complex loads and constraints for minimum weight or cost. High-dimensional decisions stress scalable optimizers and constraint handling in competition-grade structural software.'
  },
  'TopologyOptimization': {
    en: '2D MBB-beam topology optimization with SIMP: minimize compliance under a volume fraction using filtered/projected density fields for manufacturability. FEM-based black-box evaluation reflects generative structural design from continuum topology to stiff layouts.'
  },

  // ── 41–45. Robotics ──────────────────────────────────────────────────────────
  'DynamicObstacleNavigation': {
    en: 'Navigate a differential-drive robot from start to goal among moving obstacles under velocity/acceleration limits while avoiding collisions and minimizing time or path length. Simplified dynamics/obstacle laws in simulation score collisions, success, and path cost—mobile robot motion planning engineering.'
  },
  'QuadrupedGait': {
    en: 'Optimize roughly eight gait parameters for a quadruped in simulation to maximize stable forward speed. Periodic locomotion with contact dynamics and fall constraints is scored by average speed or stability proxies—legged-robot locomotion parameter tuning.'
  },
  'RobotArmCycleTime': {
    en: 'Minimize motion time for a 7-DOF KUKA LBR iiwa arm between collision-free configurations under joint limits and velocity/acceleration envelopes. Time-optimal redundant-arm planning is scored in simulation for collisions, limit violations, and cycle time.'
  },
  'PIDTuning': {
    en: 'Tune cascaded PID gains for a 2D quadrotor across multiple flight scenarios to reduce tracking error and overshoot under actuator saturation. Continuous gain vectors are scored by integrated error and stability-style constraints—low-level aerial vehicle controls engineering.'
  },
  'UAVInspectionCoverageWithWind': {
    en: 'UAV inspection coverage planning under wind disturbance: optimize paths or controls to maximize inspected area or revisit metrics while managing energy and safety margins. Wind fields couple geometric coverage with uncertainty, scored by coverage fraction and mission success in simulation.'
  },

  // ── 46. Aerodynamics ─────────────────────────────────────────────────────────
  'CarAerodynamicsSensing': {
    en: 'Optimize pressure-sensor locations on a 3D car surface to reconstruct the pressure field or aerodynamic coefficients from sparse measurements. CFD-backed or precomputed fields link to optimal experimental design; scoring quantifies reconstruction error under a sensor budget—sparse sensing for automotive aerodynamics.'
  },

  // ── 47. Wireless Channel Simulation ─────────────────────────────────────────
  'HighReliableSimulation': {
    en: 'Estimate very low BER for Hamming(127,120) over AWGN where naive Monte Carlo is inefficient: design importance sampling or variance-reduction samplers for deep-error events. Fixed evaluator settings score statistical efficiency and correctness—wireless link reliability engineering with rare-event simulation.'
  }
};

/**
 * Get the English description for a task
 */
function getTaskDescriptionEn(taskName) {
  var desc = window.TASK_DESCRIPTIONS[taskName];
  return desc ? desc.en : null;
}
