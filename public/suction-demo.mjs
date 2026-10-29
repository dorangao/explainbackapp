import {suctionPresets} from './suction-presets.mjs';
export const suctionGuideStages=['claim','confirm','prediction','pressure','ceiling','tilt','leakage','revision','design-review','transfer','complete'];
const notes={
 en:{
 claim:['Can a ceiling test prove every angle?','The preset claims ceiling support guarantees grip at every angle.','The schematic waits for a prediction before showing results.','Next sends the claim to Muse for faithful interpretation.','Interpret the claim'],
 confirm:['Confirm meaning, not truth','Read Muse’s interpretation below. The script confirms only what the preset meant.','No force test has run yet.','Next confirms locally without a provider call.','Confirm the script'],
 prediction:['Predict the missing force','The preset predicts every angle works because suction exceeds weight.','Look for the tangential component of gravity and the available friction.','Next lets code run the pinned experiment.','Check the prediction'],
 pressure:['At rest: pressure can still act','External-flow aero and sealed fan suction are separate models.','The pressure graph has slope A: Fₛ=ΔpA. Passive aero is zero at zero relative airflow.','Powered suction can exist at rest while the seal holds. No airborne thrust is modeled.','Inspect the ceiling'],
 ceiling:['Three forces at the ceiling','Suction acts up. Gravity AND ceiling reaction act down on the car.','N=Fₛ−mg. The default normal reserve is 4.39 kN.','This passes a necessary ceiling balance, not a safety test.','Try 135°'],
 tilt:['135° breaks the claim','An upside-down car can pass the ceiling balance but fail at an intermediate angle.','Available friction μN≈10.13 kN is below tangential gravity≈13.87 kN.','Static equilibrium is impossible here. The sweep is a series of static cases, not a falling-car simulation.','Double the gap'],
 leakage:['A small gap has a power cost','At fixed Δp, doubling effective gap doubles airflow and electrical power.','At 6 kPa: 5 mm needs 25.73 kW; 10 mm needs 51.47 kW, above the 30 kW line.','At 30 kW the optimistic pressure bound drops to 4.19 kPa. Actual fan performance is still unknown.','Revise and propose'],
 revision:['Ask Muse for a bounded design proposal','The revised preset proposes reducing effective leakage.','The original force and power evidence stays visible.','Next records Muse’s catalog choice and measurement proposal; code then compares all four candidates.','Compare candidates'],
 'design-review':['A candidate must satisfy both constraints','Target: 20% ceiling reserve at doubled gap, within 30 kW. This is a teaching target.','Read the checked comparison below. The 60 kW candidate cannot pass the budget.','Half leakage passes the default necessary screen. It remains an untested hypothesis, not an optimum or certification.','Explain the comparison'],
 transfer:['Transfer to a window-cleaning robot','A vertical wall needs friction to support weight. A ceiling inequality is insufficient.','The car remains a PRIMARY REFERENCE; it does not show the new robot’s hidden answers.','The worked preset supplies a fresh numeric answer and explanation. This is assisted practice.','Check the transfer'],
 complete:['From a claim to a testable design','The claim was tested, revised, compared under constraints, and applied to a new context.','You can explore the reference model and inspect each real provider request.','Code checks values; Muse assesses reasoning. No CFD, real safety proof or independent-learning claim.','Finished']},
 zh:{
 claim:['天花板测试能证明所有角度吗？','预设声称：天花板上能支撑，就能停在任何角度。','示意图会等到预测之后才展示结果。','下一步把说法发给 Muse，忠实解读含义。','解读说法'],
 confirm:['确认含义，不是确认正确','阅读下方 Muse 解读。脚本只确认预设表达的意思。','还没有进行受力检验。','下一步仅在本地确认，不调用模型。','确认脚本'],
 prediction:['预测被忽略的力','预设认为吸附力超过重量就适用于所有角度。','注意重力的切向分量与可用摩擦力。','下一步由代码运行固定实验。','检验预测'],
 pressure:['静止时，压差仍可产生力','外部气流气动力与密封风机吸附属于独立模型。','压差图的斜率是 A：Fₛ=ΔpA。外部相对气流为零时，被动气动力为零。','只要保持密封，开启风机就可能产生静止吸附；不模拟空中推力。','观察天花板'],
 ceiling:['天花板上的三个力','吸附力向上；重力与天花板对车的反力都向下。','N=Fₛ−mg；默认法向力余量约 4.39 kN。','这只通过必要的天花板受力检验，不是安全验证。','试试 135°'],
 tilt:['135° 反驳原说法','倒挂能通过法向力检验，不代表中间角度能保持。','可用摩擦 μN≈10.13 kN，小于切向重力≈13.87 kN。','此处静力平衡不可能。扫描是一系列静态案例，不模拟汽车坠落。','把间隙翻倍'],
 leakage:['小间隙，大功率代价','固定压差时，有效间隙翻倍使气流与电功率翻倍。','6 kPa 下：5 mm 需 25.73 kW，10 mm 需 51.47 kW，超过 30 kW。','30 kW 对应的乐观压差上界降到 4.19 kPa；实际风机性能仍未知。','修正并提出设计'],
 revision:['请 Muse 提出有限范围的设计','修正预设提出减少有效泄漏。','原始受力与功率证据保持可见。','下一步记录 Muse 的目录选择和测量建议，再由代码比较四种方案。','比较方案'],
 'design-review':['方案必须同时满足两个条件','目标：间隙翻倍后天花板余量 20%，且不超过 30 kW。这是教学目标。','查看下方核验表；60 kW 方案无法通过预算。','默认参数下，泄漏减半通过必要筛选，但仍是未验证假设，不是最优或安全认证。','解释比较结果'],
 transfer:['迁移到擦窗机器人','竖直墙面需要摩擦支撑重量，仅天花板不等式不够。','汽车仍仅作初始示例参考，不展示新机器人题的隐藏答案。','例解预设提供新的数值和解释，计为辅助练习。','核验迁移'],
 complete:['从说法到可检验的设计','完成了检验、修正、约束下比较，以及新情境迁移。','可继续探索参考模型，并查看真实提供商请求。','代码核验数值，Muse 评估推理。不代表 CFD、真实安全验证或独立学习证据。','已完成']}
};
export const suctionGuide=(stage,language)=>notes[language]?.[stage]??null;
export async function runSuctionDemo({language,testerAuthenticated,signal,request,show,step,play,checkpoint}){
 const check=()=>{if(signal.aborted)throw new DOMException('Stopped','AbortError');};
 const pause=async stage=>{await checkpoint(stage,signal);check();};
 const expect=(s,phase)=>{if(s.phase!==phase)throw new Error('Unexpected suction step; inspect the provider feedback.');};
 if(!testerAuthenticated||!['en','zh'].includes(language))throw new Error('Tester login and a supported language are required.');
 check();step('start');let s=await request('/api/session',{problemId:'suction',language,synthetic:true,workflow:'claim-testing'});check();expect(s,'claim');show(s);
 const submit=async expected=>{check();const preset=suctionPresets(s,language)[0];if(!preset)throw new Error('No suction preset.');step(s.phase);show(s,preset);await pause(s.phase);s=await request('/api/turn',{sessionId:s.sessionId,explanation:preset.text,demoPreset:true,...(preset.answer?{answer:preset.answer}:{})});show(s);check();expect(s,expected);};
 await submit('confirm');if(s.claim?.kind!=='all-angle-grip')throw new Error('Unexpected claim; no scripted confirmation was sent.');
 step('confirm');await pause('confirm');s=await request('/api/claim',{sessionId:s.sessionId,claimId:s.claim.id,decision:'confirm',source:'scripted-demo'});show(s);check();expect(s,'prediction');
 await submit('revision');if(!s.graph)throw new Error('Checked suction graph missing.');
 for(const stage of ['pressure','ceiling','tilt','leakage']){step(stage);const played=await play(signal,stage);check();if(!played)throw new Error('Suction playback interrupted.');await pause(stage);}
 await submit('design-review');await submit('transfer');await submit('complete');
 if(s.report?.outcome!=='assisted')throw new Error('Scripted demo must be assisted.');step('complete');return s;
}
