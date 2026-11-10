// Explicit stage contracts. Time controls focus only; it never determines artifact state.
// These are states expected along the successful planned path, not observed outputs.
const CONTRACTS = [
 [
  ['inventory','catalog','candidates','candidateReview','align','assemble','verify'],
  ['inventory','catalog','candidates','align','assemble','verify'],
  ['catalog','candidates','align','assemble','verify'],
  ['inventory','catalog','candidates','candidateReview','align','assemble','verify']
 ],
 [
  ['inventory','catalog','candidates','assemble','verify'],
  ['inventory','catalog','candidates','decide','assemble','verify'],
  ['inventory','catalog','candidates','candidateReview','compare','assemble','verify'],
  ['inventory','catalog','integrate','candidates','decide','selectionReview','assemble','verify']
 ],
 [
  ['inventory','catalog','candidates','selectionReview','assemble','verify'],
  ['inventory','catalog','candidates','decide','selectionReview','assemble','verify'],
  ['inventory','catalog','decide','selectionReview','assemble','verify'],
  ['inventory','catalog','decide','selectionReview','assemble','verify']
 ]
];
const SEMANTICS={
 inventory:{icon:'⌕',input:'原始素材池',action:'探测尺寸、帧率与时长',output:'技术清单',track:'empty',label:'待建立候选',desk:'素材清单',motion:'scan',duty:'核对媒体属性并建立索引'},
 catalog:{icon:'▦',input:'素材池 / 技术清单',action:'分工观察画面与叙事线索',output:'视觉描述与索引',track:'empty',label:'待匹配镜头',desk:'阅片工作台',motion:'scan',duty:'分析分配到的素材，提交视觉描述'},
 integrate:{icon:'≡',input:'各组视觉描述',action:'合并目录与统一字段',output:'统一视觉目录',track:'empty',label:'待匹配镜头',desk:'目录汇总',motion:'merge',duty:'汇总描述、消除目录差异'},
 candidates:{icon:'◇',input:'视觉目录 / 镜头要求',action:'比较候选与镜头要求',output:'候选列表与匹配理由',track:'candidate',label:'候选比较中',desk:'镜头候选板',motion:'choose',duty:'比较候选素材并提出匹配理由'},
 candidateReview:{icon:'✓',input:'各镜头候选列表',action:'独立检查候选与约束',output:'候选复核意见',track:'candidate',label:'候选复核中',desk:'候选核查板',motion:'check',duty:'检查候选证据，指出冲突与不足'},
 compare:{icon:'⇄',input:'候选列表与复核意见',action:'补充近似候选的差异证据',output:'候选差异与选择依据',track:'candidate',label:'比较差异',desk:'差异比较板',motion:'choose',duty:'区分近似候选，补充判别证据'},
 decide:{icon:'◇',input:'候选报告 / 视觉目录',action:'统筹选择与镜头顺序',output:'选片方案',track:'candidate',label:'决策中',desk:'选片决策板',motion:'choose',duty:'统筹镜头要求并确定选择方案'},
 selectionReview:{icon:'✓',input:'选片方案',action:'检查叙事、方向与连续性',output:'选片审查意见',track:'selected',label:'方案复核中',desk:'连续性检查板',motion:'check',duty:'核对已选方案与跨镜头约束'},
 align:{icon:'↔',input:'完整镜头候选 / 已选方案',action:'确定裁切区间与帧数分配',output:'帧区间与拼接计划',track:'align',label:'全部槽位已有方案 · 对齐帧区间',desk:'帧区间工作台',motion:'align',duty:'求解每个镜头的起止帧与长度'},
 assemble:{icon:'✂',input:'选片结果与剪辑要求',action:'按方案组织拼接与输出',output:'待验证交付物',track:'assemble',label:'全部槽位就绪 · 拼接中',desk:'拼接工作台',motion:'assemble',duty:'按选片方案组织时间线与交付文件'},
 verify:{icon:'✓',input:'组装后的交付物',action:'核对结构、技术规格与要求',output:'验收报告 / 修复反馈',track:'verify',label:'完整序列 · 验收中',desk:'交付检查台',motion:'check',duty:'检查完整交付物，输出验收意见'}
};
SEMANTICS.evidence={...SEMANTICS.selectionReview,input:'已确认的选片方案',action:'整理选片理由与证据帧',output:'选择证据文件',desk:'证据整理台',duty:'汇总每个镜头的选择理由与可见差异'};
SEMANTICS.eventMatch={...SEMANTICS.candidates,input:'素材描述与六处状态变化',action:'定位变化点并检查可用区间',output:'变化帧与区间候选',desk:'变化点定位台',duty:'定位状态变化的首帧，核对变化前后的画面'};
SEMANTICS.beatAlign={...SEMANTICS.align,input:'变化帧、候选区间与节拍表',action:'让变化帧对齐各槽重音帧',output:'节拍对齐的帧区间',label:'全部槽位已有区间 · 变化点对齐重音',desk:'节拍对齐台',duty:'检查事件帧映射、槽位长度和六个来源互异'};
SEMANTICS.narrationMatch={...SEMANTICS.candidates,input:'旁白脚本与素材目录',action:'逐窗口匹配画面与句内事件',output:'窗口选片与同步区间',desk:'旁白匹配台',duty:'让整段画面贴合旁白，并定位句内事件'};
SEMANTICS.narrationAlign={...SEMANTICS.align,input:'六窗口选片与旁白时间点',action:'复核画面事件与句子起点',output:'同步方案与事件表',label:'六窗口已选 · 句内事件同步',desk:'旁白同步台',duty:'核对窗口长度、事件落点和总计1290帧'};
SEMANTICS.jcut={...SEMANTICS.assemble,input:'六镜头选择与原声',action:'第六段声音提前24帧，画面从源帧24开始',output:'声画序列与双轨 EDL',label:'六段就绪 · 第六段声音比画面提前24帧',desk:'J-cut 声画台',duty:'保持第五段完整画面，用第六段声音替换其最后24帧原声'};
SEMANTICS.intercutPlan={...SEMANTICS.selectionReview,input:'A线四段 / B线三段候选',action:'确定 A1 B1 A2 B2 A3 B3 A4 顺序',output:'七段交叉剪辑方案',desk:'双线顺序台',duty:'核对两线内部顺序、交替关系与候选唯一性'};
SEMANTICS.intercut={...SEMANTICS.assemble,input:'七段交叉剪辑方案',action:'A/B 两线交替硬切，A线开场和收尾',output:'完整交叉序列与证据',label:'七段就绪 · A/B 交替，A线首尾',desk:'双线交叉台',duty:'按 A1 B1 A2 B2 A3 B3 A4 拼接完整镜头'};
function contract(c,m,i){return SEMANTICS[CASES[c].models[m].stages[i].semantic]}
