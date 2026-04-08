# Frontier-Eng 有效 v1 任务一览（tasks.md）

本文档对应仓库根目录 [README.md](README.md) 中 **Task Progress & Planning** 表里标注为 **v1** 的 **47** 个 benchmark 任务（`MuonTomography` 虽在表中但明确暂不计入有效 v1 池，故不在此列出）。每条给出推荐的 `task.benchmark`（或 EngDesign 的专用入口）、约 **100–150 个汉字**的中文说明，以及并排的 **English** 说明，便于后续引用。

统一评测入口一般为：`python -m frontier_eval task=unified task.benchmark=<下方 ID> ...`；**EngDesign** 使用 `task=engdesign`（见该域 README）。具体环境与超时等覆盖参数请以各 benchmark 的 README 与 `frontier_eval/conf/batch/` 下矩阵为准。

---

## 1. `Astrodynamics/MannedLunarLanding`

**中文**：面向载人航天器月面软着陆的轨迹优化问题，在推力幅值、燃料消耗、动力学与过程约束共同作用下，寻求从轨道到终端状态的可行轨迹，使着陆安全、平稳并尽量节省推进剂。任务强调连续时间最优控制与工程可实现性，评测会检验终端精度、约束满足与性能指标的平衡，体现高维非线性最优控制在航天场景中的难度。

**English**: This benchmark targets soft-landing trajectory optimization for a crewed lunar lander under thrust limits, propellant use, and dynamical/path constraints. The goal is a feasible trajectory from orbit to terminal conditions that lands safely while saving fuel where possible. Evaluation stresses nonlinear optimal control, constraint satisfaction, and terminal accuracy—typical of real astrodynamics optimization.

---

## 2. `KernelEngineering/MLA`

**中文**：面向 GPU 上多头注意力（MLA 类）算子的实现与优化，要求在正确性前提下提升内核在目标硬件上的吞吐或延迟表现。参与者通常需处理内存合并、寄存器与共享内存使用、块级并行划分等低层细节。评测结合官方或基准给定的数值正确性检查与性能指标，体现高性能计算里“算子级”工程优化与硬件协同设计的挑战。

**English**: This task focuses on implementing and tuning a multi-head attention–style (MLA) GPU kernel for correctness and strong throughput or latency on the target device. It exercises memory coalescing, register/shared-memory pressure, and launch configuration. The scorer combines numerical checks with performance metrics, reflecting operator-level HPC engineering.

---

## 3. `KernelEngineering/TriMul`

**中文**：针对 GPU 上的三角化或结构化矩阵乘法类内核（TriMul）进行实现与调优，在严格数值正确性约束下追求更高性能。任务涉及张量布局、分块策略与占用率之间的权衡，并可能受显存容量限制。评测在基准工作负载上对比参考实现与候选方案，体现专用线性代数内核在真实 GPU 资源边界下的设计与优化难度。

**English**: This benchmark asks for a high-performance TriMul-style GPU kernel under strict correctness, trading off tiling, layout, and occupancy—often VRAM-bound on consumer GPUs. Evaluation runs representative workloads and scores both accuracy and speed against the benchmark’s reference, highlighting specialized GEMM-like kernel engineering.

---

## 4. `KernelEngineering/FlashAttention`

**中文**：优化因果缩放点积注意力（FlashAttention 风格）的前向 CUDA 内核，在保持与参考实现数值一致的前提下提升推理或训练中的注意力计算效率。需处理在线 softmax、分块与访存局部性等经典技巧。评测针对给定形状与硬件报告速度与正确性，代表深度学习系统里对显存带宽敏感的核心算子优化问题。

**English**: Optimize a causal scaled dot-product attention forward kernel (FlashAttention-style) for GPU execution while matching a reference numerically. The problem stresses tiled online softmax and memory locality. Scoring reports speed and correctness for fixed shapes, representing bandwidth-bound attention kernel work in production ML stacks.

---

## 5. `SingleCellAnalysis/predict_modality`

**中文**：基于单细胞 RNA 数据预测细胞表面蛋白（ADT）模态，源自 Open Problems / NeurIPS 2021 类设定。要求在有限监督与生物学噪声下学习从基因表达到蛋白质水平的映射，并满足评测方定义的总体与分组指标。任务体现多组学整合与泛化能力，是生物信息学中典型的监督学习与表示学习工程问题。

**English**: Predict surface-protein (ADT) modalities from single-cell RNA profiles in an Open Problems / NeurIPS-2021–style setup. Models must generalize under biological noise and are scored by benchmark-defined global and stratified metrics. It reflects multimodal integration in single-cell analysis.

---

## 6. `QuantumComputing/task_01_routing_qftentangled`

**中文**：量子线路编译中的路由导向优化：在给定耦合拓扑与门集下，为纠缠 QFT 类线路分配交换与插入策略，尽量减少深度、噪声敏感操作或代价函数定义的物理开销。任务将离散组合与连续参数空间结合，体现近邻约束量子处理器上真实编译流水线的工程目标。

**English**: Routing-oriented compilation for entangled QFT-style circuits: assign SWAP insertions and mapping under a coupling graph and gate set to minimize depth or a noise-aware cost. It mixes discrete layout choices with compilation objectives found in near-term superconducting processors.

---

## 7. `QuantumComputing/task_02_clifford_t_synthesis`

**中文**：Clifford+T 综合与优化问题，在给定目标酉或电路片段下，寻找 T 深度、T 数量或总门数更优的实现。任务连接容错量子计算资源理论，评测关注与参考或上界相比的综合代价，体现离散搜索与电路等价变换在量子软件栈中的核心地位。基准通过统一任务接口挂载，便于在可重复条件下横向对比多种综合策略。

**English**: Clifford+T synthesis: realize a target unitary or subcircuit with fewer T gates, lower T-depth, or cheaper total gate count. The benchmark scores against reference costs relevant to fault-tolerant quantum computing, emphasizing circuit rewriting and combinatorial optimization in QC toolchains.

---

## 8. `QuantumComputing/task_03_cross_target_qaoa`

**中文**：跨目标鲁棒 QAOA 类参数优化：在多个实例或扰动设定下联合调节量子近似优化算法的参数，使平均或最坏情形下的目标值改进。任务涉及噪声、图实例变化等不确定性，体现变分量子算法在“训练分布”上的工程鲁棒性需求。评测在统一入口下串联多实例脚本，突出跨设定稳定性与目标改进幅度，便于公平比较不同调参方案。

**English**: Cross-target robust optimization for QAOA-style variational parameters across instances or perturbations, improving mean or worst-case objective values. It captures robustness needs for VQAs when problem instances or noise conditions shift—an engineering angle on quantum heuristic performance.

---

## 9. `Cryptographic/AES-128`

**中文**：在固定 AES-128 CTR 模式语义下，优化软件实现（如查表、流水线或指令级并行）的吞吐与延迟，同时不得破坏标准规定的输入输出与安全性假设下的功能正确性。任务连接嵌入式与高性能密码工程，评测以可重复基准向量与性能计数为主，可在固定消息分块策略下报告每字节耗时，便于比较 SIMD、查表与纯算术实现路径。

**English**: Optimize a software AES-128 CTR implementation for throughput/latency while preserving standard-compliant I/O and functional correctness on test vectors. It mirrors cryptographic engineering trade-offs between table lookups, SIMD, and side-channel-aware design where applicable.

---

## 10. `Cryptographic/SHA-256`

**中文**：对 SHA-256 哈希核心循环进行实现或调优，在给定消息长度分布下最大化处理速率并保证与标准测试向量一致。任务考察位运算、轮函数展开与缓存行为，代表安全协议栈中无处不在的哈希原语性能工程。通过 unified benchmark 暴露恒定接口，智能体可在相同测试向量与长度分布下迭代优化循环体与内存布局，获得可横向对比的吞吐结果。

**English**: Implement or tune the SHA-256 compression function for speed on representative message lengths with bit-exact agreement on standard vectors. The task stresses bitwise rounds, unrolling, and memory behavior—typical hash primitive optimization in TLS and blockchain stacks.

---

## 11. `Cryptographic/SHA3-256`

**中文**：针对 SHA3-256（Keccak）海绵结构的软件实现进行性能优化，在保持 Keccak-f 置换正确性的前提下提升每字节处理成本。与 SHA-2 相比状态更大、轮函数不同，评测同样基于标准向量与吞吐指标，体现后量子时代常用摘要算法的工程侧优化空间。可向量化与展开轮函数并重，评测区分数值正确与峰值带宽利用，适合作为位运算密集内核的打磨题。

**English**: Accelerate a SHA3-256 (Keccak sponge) implementation while preserving correct Keccak-f permutations and sponge semantics on test vectors. It differs structurally from SHA-256 and highlights optimization of the round function and state layout for modern CPUs.

---

## 12. `EnergyStorage/BatteryFastChargingProfile`

**中文**：锂离子电池快速充电电流曲线优化，在电压上限、温升、老化或极化等约束下规划时间上的电流分布，以缩短充电时间并控制退化风险。任务将最优控制与电化学简化模型结合，评测关注约束违反程度与目标（如充电时长、能量吞吐）的权衡，并对整条电流轨迹做可行性检查，体现从仿真曲线到可部署充电策略的完整工程链条。

**English**: Optimize time-varying fast-charge current profiles for a Li-ion cell under voltage, thermal, and degradation-style constraints to reduce charge time while limiting aging risk. It couples optimal control with reduced electrochemical models and scores constraint slack versus charging objectives.

---

## 13. `EnergyStorage/BatteryFastChargingSPMe`

**中文**：在 SPMe-T-Aging 风格的降阶电化学—热—老化耦合模型下，进行分阶段快充策略优化，同时考虑镀锂、容量衰减等长期效应的代理指标。比纯曲线任务更强调物理一致性与多时间尺度约束。评测验证轨迹可行性与综合代价，面向电池管理系统算法设计场景，对多阶段电流与温度—老化耦合指标一并考核，更贴近整车或储能系统级研发需求。

**English**: Staged fast-charge optimization under a reduced SPMe-T-Aging–style coupled electrochemical, thermal, and aging model, including proxies for plating and fade. It is more physics-heavy than profile-only tasks and scores feasible trajectories against composite objectives for BMS-oriented algorithms.

---

## 14. `SustainableDataCenterControl/hand_written_control`

**中文**：基于 SustainDC 场景的联合控制基准：同时调度 IT 负载转移、冷却系统与储能充放电，以降低能耗、电费或碳排并满足服务水平协议。状态空间大、约束多，体现数据中心能源系统与电网互动的协同优化。评测在统一流水线中运行候选策略并汇总能耗、电费、碳排与 SLA 等多指标，在相同场景脚本下比较不同控制律与启发式调度。

**English**: A SustainDC joint-control benchmark coordinating load shifting, cooling, and battery dispatch to reduce energy cost or carbon while meeting SLA-style constraints. Large coupled state and multi-objective trade-offs reflect real sustainable datacenter operations, evaluated through the unified pipeline.

---

## 15. `ReactionOptimisation/snar_multiobjective`

**中文**：连续流 SnAr 反应过程的多目标优化，在产率、副产物或废物等目标间寻求帕累托意义上的改进，决策变量为连续工艺条件。任务连接化学工程与真实实验代理模型，评测调用 SUMMIT 生态中的评估器。体现流程工业中安全、环保与产能并存时的多目标决策难度。

**English**: Multi-objective optimization of a continuous-flow SnAr reaction, trading productivity against waste or byproduct metrics along a Pareto front over continuous operating variables. Grounded in chemical engineering emulators (SUMMIT family), it reflects real plant trade-offs among yield, waste, and operability.

---

## 16. `ReactionOptimisation/mit_case1_mixed`

**中文**：MIT case1 风格的混合变量反应优化：在连续工艺变量之外包含离散催化剂类别选择，以最大化产率或类似目标。任务考察混合整数与连续黑盒优化的结合，评测在统一任务接口下调用领域验证脚本。代表高通量实验与数字化孪生中常见的“结构+操作条件”联合寻优。

**English**: Mixed-variable reaction yield optimization from the MIT_case1 setting: continuous process variables plus a categorical catalyst choice. It stresses black-box optimization with discrete decisions, evaluated via the benchmark’s unified hook into SUMMIT-style verification—common in digital-twin reaction tuning.

---

## 17. `ReactionOptimisation/reizman_suzuki_pareto`

**中文**：Reizman Suzuki 反应代理模型上的帕累托优化，在催化剂类型与连续操作条件上同时搜索，以改进多个相互冲突的化学指标。任务强调多目标黑盒与化学可行性边界，评测依赖领域仿真或表格模型，体现制药与精细化工中配方与工艺协同设计场景。统一评测挂载 SUMMIT 侧脚本，保证候选解在相同随机种子与版本下可复核，便于公平对比不同搜索策略。

**English**: Pareto optimization on the Reizman Suzuki emulator over catalyst choice and continuous conditions to improve conflicting chemical metrics. Multi-objective black-box search under chemistry-side constraints is scored through the benchmark’s evaluator, mirroring co-design of recipe and operating point.

---

## 18. `Optics/adaptive_temporal_smooth_control`

**中文**：自适应光学控制中在时间平滑性与校正质量之间的权衡：可变形反射镜或等效执行器指令需抑制高频抖动以避免器件饱和或机械应力，同时维持对波前误差的有效抑制。任务将离散时间片上的控制序列作为优化变量，体现闭环光学系统的时间域工程约束，评测常对残余波前误差与指令变化率联合计分，避免只顾校正而忽略执行器寿命。

**English**: Adaptive optics control balancing temporal smoothness of DM commands against correction quality—reducing high-frequency actuator chatter while tracking wavefront error. Optimizing control time series reflects temporal constraints in closed-loop AO hardware.

---

## 19. `Optics/adaptive_fault_tolerant_fusion`

**中文**：多波前传感器故障或降级情形下的容错融合：在部分 WFS 失效或噪声恶化时仍重建可靠波前估计并分配校正。任务考察鲁棒估计与冗余利用，评测对合成故障模式下的性能退化进行量化，对应大型望远镜或激光系统中高可用波前控制需求，可在注入式故障列表上报告残余像差与校正能效，检验融合算法弹性。

**English**: Fault-tolerant fusion across multiple wavefront sensors when some channels fail or degrade, maintaining reliable wavefront estimates and correction commands. Scoring uses synthetic fault patterns, reflecting availability requirements in multi-WFS AO systems.

---

## 20. `Optics/phase_fourier_pattern_holography`

**中文**：傅里叶域相位全息设计：优化相位板使远场或焦平面呈现目标强度图案，常用于分束与整形。任务在离散像素相位与物理传播模型之间建立可微或黑盒链路，体现计算全息中的相位检索与工程制造约束。评测比较目标与实现图案间的误差范数或效率指标。

**English**: Fourier-domain phase holography: optimize a phase plate so propagated intensity matches a target pattern for beam shaping or splitting. Pixelized phase under physical propagation models links to phase-retrieval-style engineering with scored intensity error or efficiency metrics.

---

## 21. `Optics/phase_dammann_uniform_orders`

**中文**：达曼光栅类相位分布设计，使多个衍射级次获得近似均匀能量分配，用于阵列照明与光通信分路。优化变量为周期内相位台阶或连续相位剖面，需满足能量守恒与制造离散化。任务体现二元光学元件设计中离散与连续折中，评测关注各级均匀性与零级泄漏等。

**English**: Dammann-grating-style phase design for uniform power across selected diffraction orders used in array illumination. Phase profiles must respect periodicity and fabrication quantization; scoring targets order uniformity and stray zero-order leakage—classic binary optics engineering.

---

## 22. `Optics/fiber_wdm_channel_power_allocation`

**中文**：波分复用光纤链路中的信道与发射功率联合分配，在非线性串扰、放大器增益谱与 OSNR 约束下最大化容量或最小化误码代价。任务为连续（或离散）功率向量优化，体现光网络物理层资源分配。评测使用链路仿真给出的端到端质量指标，可显式惩罚非线性串扰与功率裕度不足，区分仅优化局部信噪比与全局链路可行性的方案差异。

**English**: Joint WDM channel and launch-power allocation under nonlinear crosstalk, amplifier gain ripple, and OSNR limits to maximize capacity or minimize error-related cost. Continuous power vectors reflect physical-layer networking optimization scored by link simulation outputs.

---

## 23. `Optics/fiber_mcs_power_scheduling`

**中文**：光接入或相干系统中调制编码方案（MCS）与发射功率的联合调度，在时变信道或业务需求下选择离散 MCS 等级与功率水平，满足 BLER 或时延约束。任务为混合离散—连续决策，体现 IM-DD 或相干光系统中链路自适应的工程实现空间。评测常在统一时间轴上回放信道轨迹，对丢包、重传与能耗联合计分，检验策略在快衰落下的稳健性。

**English**: Joint MCS and transmit-power scheduling for optical links under time-varying channels or traffic, choosing discrete modulation orders and power levels subject to BLER or latency constraints. Mixed discrete–continuous control mirrors link adaptation in optical access and coherent systems.

---

## 24. `Optics/fiber_guardband_spectrum_packing`

**中文**：在给定保护带与滤波器滚降约束下对频谱进行信道放置与间隔优化，以提升总吞吐或频谱效率并避免邻道干扰。任务将频谱槽位与中心频率作为变量，属于组合与几何优化结合。评测基于仿真给出的干扰与容量惩罚，对应运营商与 DCI 中的频谱工程问题。

**English**: Spectrum packing with guard-band and filter roll-off constraints—placing channels to maximize throughput while limiting adjacent-channel interference. Combines combinatorial placement with continuous spacing, scored by interference-aware capacity metrics from simulation.

---

## 25. `Optics/holographic_multifocus_power_ratio`

**中文**：多焦点全息中的焦点间功率比控制：在多个轴向或横向焦点位置分配目标强度比例，同时抑制背景与串扰。相位优化需满足物理传播与非负强度等隐约束，任务服务于并行光镊、多点加工等应用。评测对功率分配误差与均匀性进行量化，并可约束总衍射效率与背景泄漏，体现制造容差下的多目标折中。

**English**: Holographic multi-focus power-ratio control: allocate target intensity shares across foci while suppressing background and crosstalk. Phase optimization under propagation physics supports optical tweezers or parallel micromachining, scored by ratio error and uniformity metrics.

---

## 26. `Optics/holographic_multiplane_focusing`

**中文**：多平面全息聚焦：同时在多个深度或横向平面上形成焦点阵列，用于三维成像激励或体积显示片段。优化需处理层间串扰与衍射效率折中，任务体现三维光场整形的计算量与物理一致性要求。评测比较各平面目标与实际强度分布的吻合度，并鼓励在串扰受控前提下提升整体能量利用率，服务三维光场工程应用。

**English**: Multi-plane holographic focusing to create focal arrays at several depths or lateral planes for 3D excitation or volumetric display segments. Trade-offs include inter-plane crosstalk and diffraction efficiency; scoring measures per-plane target fidelity versus simulated intensity.

---

## 27. `ComputerSystems/MallocLab`

**中文**：经典动态内存分配器实验：在仅允许修改 `mm.c` 中 EVOLVE 区块的前提下，实现 `malloc`/`free`/`realloc` 等接口，在真实轨迹驱动下最大化空间利用率与吞吐。任务考察显式空闲链表、分离适配、隔离与合并策略等系统底层设计，评测由 `mdriver` 风格驱动程序给出性能与正确性得分。轨迹覆盖多种真实分配模式，可区分仅在微基准上取巧与在完整负载下仍稳健的分配器实现。

**English**: The CSAPP-style Malloc Lab: implement `malloc`/`free`/`realloc` in a constrained region to maximize utilization and throughput on realistic allocation traces. It exercises segregated lists, coalescing, and throughput-oriented heuristics, scored by an mdriver-like harness for correctness and performance.

---

## 28. `EngDesign`（`task=engdesign`，多案例：CY_03, WJ_01, XY_05, AM_02, AM_03, YJ_02, YJ_03）

**中文**：来自 EngDesign 上游仓库的一组贴近真实机械、拓扑与多学科设计实践的工程案例，在统一 Docker 评测流程下提交候选设计脚本。各子案例对应不同结构、载荷或制造约束下的尺寸、形状或拓扑决策，评分依赖各案例自带的 rubric 与仿真流水线。在 v1 统计中计为单一 benchmark 族，但运行时可覆盖多个独立设计任务。

**English**: A bundle of EngDesign-sourced engineering cases (CY_03, WJ_01, XY_05, AM_02, AM_03, YJ_02, YJ_03) evaluated through Docker-backed scripts and per-case rubrics spanning structural, topology, and related design tasks. In the v1 pool it counts as one benchmark family though multiple distinct problem providers exist; use `task=engdesign` per the domain README.

---

## 29. `InventoryOptimization/tree_gsm_safety_stock`

**中文**：树状多层供应链上的安全库存放置（guaranteed-service / GSM 思路）：在服务水平与提前期不确定性下，为各节点决策安全库存量或覆盖时间，最小化系统总库存成本。任务结构为网络优化，体现运营管理中多级库存理论的工程化实现。服务水平可映射为缺货概率或填充率约束，评测在树网络上汇总持有、转运与缺货惩罚，检验策略是否真正降低系统总成本。

**English**: Tree-structured multi-echelon safety-stock placement under guaranteed-service–style assumptions: choose safety stocks or coverage times per node to meet service targets while minimizing system-wide holding cost—classic supply-chain network inventory optimization.

---

## 30. `InventoryOptimization/general_meio`

**中文**：一般网络拓扑下的多品项库存与补货优化（MEIO），目标由仿真或样本路径期望成本刻画，决策可含基库存水平、订货点等。任务允许非树形依赖与更现实的转运结构，评测强调随机需求下的稳健策略搜索。体现大规模库存仿真与策略优化结合的工业场景。

**English**: General-topology multi-echelon inventory optimization (MEIO) with simulation-based expected cost objectives over stochastic demand, possibly including non-tree networks. Policy search targets base-stock–like parameters under sample-path evaluation—realistic MEIO engineering beyond trees.

---

## 31. `InventoryOptimization/joint_replenishment`

**中文**：多 SKU 联合补货问题：共享固定订购成本或车次约束下，决定各品种订货批量与时机，平衡持有成本与缺货风险。任务为混合整数或大规模非线性规划形态，体现零售与分销中“拼单”带来的组合爆炸。评测在给定需求过程下比较总成本或服务水平，订单合并可降低单次固定费用但会抬高在途与持有库存，需在随机样本上估计期望成本与波动。

**English**: Multi-SKU joint replenishment with shared setup or truck costs: choose lot sizes and timings to trade holding versus stockout under stochastic or deterministic demand. Mixed structure reflects retail distribution “order pooling” combinatorics scored by total cost or service level.

---

## 32. `InventoryOptimization/finite_horizon_dp`

**中文**：有限时域随机库存控制：用时变订货或生产策略最小化折扣或总期望成本，状态含库存位势与可能的信息结构。任务适合动态规划或近似动态规划方法，体现短期促销、季节需求等下的运营决策。评测在滚动或固定视界上累计成本与约束违反。

**English**: Finite-horizon stochastic inventory control via time-varying policies minimizing discounted or total expected cost over a known horizon. State may include on-hand inventory and information delays; scoring rolls out costs and constraint violations—typical for promotional or seasonal planning.

---

## 33. `InventoryOptimization/disruption_eoqd`

**中文**：供应中断风险下的经济订货批量（EOQ 族）扩展：在随机到货或供应可用性波动下优化批量与再订货点，使长期期望成本最优。任务将经典 EOQ 与可靠性、风险模型结合，体现后疫情时代供应链韧性议题。评测通过仿真或解析近似比较策略表现，可刻画断供长度与恢复速率对最优策略形态的影响，适合研究韧性库存政策差异。

**English**: EOQ-style lot-sizing under supply disruptions: optimize order quantities and reorder points when supply availability is stochastic, minimizing long-run expected cost blending holding, shortage, and ordering. It extends classical EOQ with resilience-motivated uncertainty modeling.

---

## 34. `PyPortfolioOpt/robust_mvo_rebalance`

**中文**：鲁棒均值—方差组合再平衡：在估计误差、行业或因子暴露及换手率约束下，调整持仓权重以改善最坏情形或收缩风险下的夏普类指标。任务将凸鲁棒优化与离散换手惩罚结合，体现资产管理中的合规与交易成本。评测在给定历史或情景数据上计算组合指标与约束违反。

**English**: Robust mean-variance portfolio rebalancing under estimation uncertainty plus sector/factor/turnover constraints to improve out-of-sample or worst-case risk-return trade-offs. Convex robustification meets practical trading limits; scoring uses benchmark return/covariance data and constraint slacks.

---

## 35. `JobShop/abz`

**中文**：经典作业车间调度问题（JSSP）ABZ 实例族上的完工时间或拖期优化，决策为各工序在机器上的排序，属于强 NP 难组合优化。任务检验启发式、元启发式或约束规划在标准基准上的可扩展性。评测以已知下界或最优参考衡量相对差距，代表离散制造排产核心难题，并与 SWV、TA 等族并列构成标准测试床，便于检验算法可迁移性。

**English**: Classical job-shop scheduling on the ABZ benchmark family (Adams, Balas, Zawack 1988): sequence operations on machines to minimize makespan or tardiness—strongly NP-hard combinatorial optimization. Scoring compares against published bounds/optima for relative gap, a core manufacturing scheduling challenge.

---

## 36. `JobShop/swv`

**中文**：JSSP 的 SWV 实例族优化，规模与结构不同于 ABZ/TA，强调算法在不同拓扑约束图上的泛化。决策空间为置换或时间索引编码，常用遗传、禁忌搜索或混合整数法求解。评测同样以标准最优或界为参照，体现排产算法在多样化标准测试床上的稳健性，并鼓励在多种车间规模上报告一致的最优间隙，避免只对单一族过拟合。

**English**: JSSP on the SWV family (Storer, Wu, Vaccari 1992): another standard suite stressing algorithm robustness across shop layouts and sizes. Encodings range from permutations to time-indexed MILP; scoring references published best-known values for optimality gaps.

---

## 37. `JobShop/ta`

**中文**：JSSP 的 TA（Taillard）大规模实例族，广泛用于测试排产算法的时间极限与解质量。任务在数十作业与机器组合上最小化最大完工时间，对局部搜索与并行化实现提出工程要求。评测以 Taillard 最优或历史最佳为基准，是检验工业级 JSSP 求解器能力的试金石；大规模邻域操作与并行探索若实现不当会迅速成为时间瓶颈。

**English**: JSSP on Taillard’s TA family—large, widely used instances for makespan minimization that stress heuristics and parallel search at scale. Scoring against Taillard best-known solutions benchmarks industrial-grade job-shop solvers.

---

## 38. `StructuralOptimization/ISCSO2015`

**中文**：国际结构优化竞赛 2015 风格问题：45 杆平面桁架的尺寸与节点坐标联合优化，在应力、位移与体积约束下最小化结构质量或合规度。任务连接有限元分析与梯度-free 或基于梯度的优化器接口。评测调用领域验证程序输出约束违反与目标值，体现土木工程概念设计阶段自动化。

**English**: ISCSO 2015–style 45-bar 2D truss sizing and shape optimization under stress, displacement, and volume constraints to minimize mass or compliance. FEM-linked black-box evaluation reflects automated conceptual structural design in civil engineering competitions.

---

## 39. `StructuralOptimization/ISCSO2023`

**中文**：ISCSO 2023 大规模三维桁架（约 284 杆）截面尺寸优化，在复杂荷载与约束下寻求最轻或最经济设计。决策变量维数高，对优化算法可扩展性与约束处理要求严格。评测使用官方评分管道，体现从二维到三维桁架工程优化的跃迁与计算成本；杆件与工况耦合使单次仿真昂贵，黑盒或代理模型驱动搜索更具现实意味。

**English**: ISCSO 2023 large 3D truss (~284 members) sizing under complex loads and constraints for minimum weight or cost. High-dimensional decisions stress scalable optimizers and constraint handling in competition-grade structural software.

---

## 40. `StructuralOptimization/TopologyOptimization`

**中文**：经典 MBB 梁二维拓扑优化（SIMP）：在体积分数上限下最小化结构柔度，材料密度场经滤波与投影保持可制造性。任务将连续密度场离散化为有限元模型，体现结构工程中从形状到拓扑的生成式设计。评测比较柔度值与体积约束满足情况；滤波抑制棋盘格与孤岛伪解，双约束同时满足程度反映工程可制造边界。

**English**: 2D MBB-beam topology optimization with SIMP: minimize compliance under a volume fraction using filtered/projected density fields for manufacturability. FEM-based black-box evaluation reflects generative structural design from continuum topology to stiff layouts.

---

## 41. `Robotics/DynamicObstacleAvoidanceNavigation`

**中文**：差分驱动移动机器人在动态障碍物环境中从起点到终点的运动规划与控制：需避碰、满足速度加速度限制并尽量缩短时间或路径长度。任务将感知简化为给定障碍运动规律，强调实时重规划或反馈控制。评测在仿真中统计碰撞、到达与代价指标。

**English**: Navigate a differential-drive robot from start to goal among moving obstacles under velocity/acceleration limits while avoiding collisions and minimizing time or path length. Simplified dynamics/obstacle laws in simulation score collisions, success, and path cost—mobile robot motion planning engineering.

---

## 42. `Robotics/QuadrupedGaitOptimization`

**中文**：四足机器人步态参数优化：通常调节约八个步态相关连续参数，在仿真中最大化稳定前进速度或特定方向速度。任务连接周期性运动与接触动力学，对参数边界与跌倒约束敏感。评测在物理引擎中测量平均速度、能耗或稳定性代理量，并可加入地面摩擦与关节力矩限制，对跌倒率与能效联合加权以抑制不切实际的爆发步态。

**English**: Optimize roughly eight gait parameters for a quadruped in simulation to maximize stable forward speed. Periodic locomotion with contact dynamics and fall constraints is scored by average speed or stability proxies—legged-robot locomotion parameter tuning.

---

## 43. `Robotics/RobotArmCycleTimeOptimization`

**中文**：七自由度 KUKA LBR iiwa 机械臂从起始到目标构型的无碰撞运动时间最小化：需同时处理关节限位、速度与加速度包络及工作空间障碍。任务体现机械臂轨迹优化与时间最优路径在冗余自由度下的搜索。评测在仿真中检查碰撞、关节超限与时间指标；冗余自由度允许多条同伦类轨迹，鼓励在避障前提下显著缩短关节空间运动时间。

**English**: Minimize motion time for a 7-DOF KUKA LBR iiwa arm between collision-free configurations under joint limits and velocity/acceleration envelopes. Time-optimal redundant-arm planning is scored in simulation for collisions, limit violations, and cycle time.

---

## 44. `Robotics/PIDTuning`

**中文**：二维四旋翼级联 PID 控制器调参：在多个典型飞行场景（如阶跃、扰动）下最小化跟踪误差与超调，同时满足控制量饱和与稳定性。任务将连续增益作为决策变量，体现航空器低层控制工程中经验与自动调谐结合。评测对每条轨迹积分误差与约束违反加权。

**English**: Tune cascaded PID gains for a 2D quadrotor across multiple flight scenarios to reduce tracking error and overshoot under actuator saturation. Continuous gain vectors are scored by integrated error and stability-style constraints—low-level aerial vehicle controls engineering.

---

## 45. `Robotics/UAVInspectionCoverageWithWind`

**中文**：风扰动下的无人机巡检覆盖规划：在给定风场或随机风扰模型中规划路径或控制输入，使对目标区域的覆盖比例、重访时间或能耗最优。任务将空气动力学简化与几何覆盖结合，体现户外 UAV 任务的不确定性。评测在仿真中统计覆盖度、安全间隔与任务完成度。

**English**: UAV inspection coverage planning under wind disturbance: optimize paths or controls to maximize inspected area or revisit metrics while managing energy and safety margins. Wind fields couple geometric coverage with uncertainty, scored by coverage fraction and mission success in simulation.

---

## 46. `Aerodynamics/CarAerodynamicsSensing`

**中文**：三维汽车表面有限传感器布点优化：在给定传感器数量下选择测点位置，使由测压数据重构的表面压力场或气动力参数误差最小。任务结合 CFD 或预计算流场与最优实验设计思想。评测对重构精度与布点可行性进行量化，对应实车或风洞测压工程的稀疏传感问题。

**English**: Optimize pressure-sensor locations on a 3D car surface to reconstruct the pressure field or aerodynamic coefficients from sparse measurements. CFD-backed or precomputed fields link to optimal experimental design; scoring quantifies reconstruction error under a sensor budget—sparse sensing for automotive aerodynamics.

---

## 47. `WirelessChannelSimulation/HighReliableSimulation`

**中文**：高可靠通信链路中极低误码率（BER）估计：对 Hamming(127,120) 等编码在 AWGN 信道下，直接蒙特卡洛样本不足，需设计重要性采样或方差控制策略高效估计深衰落区 BER。任务强调统计估计与通信物理层知识结合。评测在固定评估器设置下比较估计方差或无偏性相关指标，可在固定随机流上报告置信区间宽度，突出稀有事件仿真效率差异。

**English**: Estimate very low BER for Hamming(127,120) over AWGN where naive Monte Carlo is inefficient: design importance sampling or variance-reduction samplers for deep-error events. Fixed evaluator settings score statistical efficiency and correctness—wireless link reliability engineering with rare-event simulation.

---

## 参考

- 任务表与 v1 说明：[README.md](README.md) § Task Progress & Planning  
- 统一评测框架：[frontier_eval/README.md](frontier_eval/README.md)  
- 批量矩阵示例：`frontier_eval/conf/batch/v1_cpu_openevolve_p8_i100_gemini-3.1-pro-preview.yaml` 等（具体条目可能随机器拆分 GPU/CPU 子集，**47** 以 README 中 v1 标记为准）。
