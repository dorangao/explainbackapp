export const areaFromHash=hash=>hash==='#physics'?'physics':hash==='#quantum'?'quantum':'studio';
export function studioWalkthrough(language='en',kind='model'){
 const zh=language==='zh',say=(en,cn)=>zh?cn:en;
 return {
  title:say('Try the creation story','体验课程创作过程'),
  steps:[
   {title:say('1 · Create','1 · 创建'),detail:say('Ask a new question. Muse drafts a model or process you can inspect.','提出一个新问题，让 Muse 起草可审阅的模型或过程。')},
   {title:say('2 · Review & revise','2 · 审阅与修改'),detail:say('Check the assumptions, then request one useful change. Review the new draft.','检查假设，提出一个有用的修改，再审阅新草稿。')},
   {title:say('3 · Operate','3 · 操作'),detail:say('Predict, change a parameter or step, and try a fresh case in either language.','先预测，再调整参数或步骤，最后用中英文尝试新情境。')}
  ],
  topic:say('Why does coffee cool more slowly near room temperature? Create an adjustable Newton cooling model with initial temperature, room temperature and cooling coefficient. Use minutes and degrees Celsius. State the ideal assumptions.','咖啡接近室温时为什么冷却更慢？创建可调的牛顿冷却模型，包含初始温度、室温和冷却系数，使用分钟和摄氏度，并说明理想假设。'),
  revision:kind==='process'?say('Clarify one conditional or skipped step in this process. Keep the topic and explain when the simplified sequence changes. Improve the fresh application question in both languages.','澄清这个过程中一个有条件发生或可以跳过的步骤。保持主题，说明简化顺序何时会变化，并改进中英文迁移题。'):say('Add or refine a useful second output that helps test the claim, with a clear label, formula and units. Keep the topic, inputs and existing output. Explain what comparing the two graphs teaches, in both languages.','增加或改进一个有助于检验观点的输出，明确标签、公式和单位。保留主题、输入和现有输出，用中英文说明比较两个图像能学到什么。'),
  operate:kind==='process'?say('Predict, then play or select a step. The sequence and answer are authored and need review; playback does not verify them.','先预测，再播放或选择步骤。过程与答案来自创作，需要审阅；播放并不验证其正确性。'):say('Predict first. Change one input, predict again, then play or scrub. A calculation checks the authored model, not its scientific truth.','先预测，改变一个输入后再次预测，再播放或拖动。计算核对的是创作的模型，并不验证其科学正确性。')
 };
}
