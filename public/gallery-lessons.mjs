// Reviewed lessons that open without sign-in. Playback is local: no provider call.
// Provenance is recorded per lesson. "muse" lessons were drafted by Meta muse-spark-1.3
// during the frozen October 27, 2026 evaluation run, then edited by the author after
// the content review recorded in docs/studio-evaluation.md. "catalog" lessons are
// hand-authored text over the existing checked experiments.
const bi=(en,zh)=>({en,zh});
export const galleryLessons=Object.freeze([
 {id:'cooling',kind:'model',source:'muse',
  summary:bi('Adjust initial temperature, room temperature and the cooling coefficient; test whether a hot drink loses the same degrees each minute.','调整初始温度、室温和冷却系数，检验热饮是否每分钟降低相同的度数。'),
  lesson:{version:2,title:bi('Newton cooling: how hot objects cool','牛顿冷却：热物体如何降温'),intro:bi('Explore how temperature moves toward its surroundings using an ideal cooling model.','用理想冷却模型探索温度如何向环境温度靠近。'),chapters:[{experiment:'generated',
   framing:bi('A cup of coffee sits in a room. Before looking at the graph, decide whether it loses the same number of degrees every minute.','一杯咖啡放在房间里。在看图之前，先判断它是否每分钟降低相同的度数。'),
   explanation:bi('Move the sliders to change the initial temperature, room temperature and cooling coefficient. Watch the curve bend: equal time steps give smaller drops later, unlike a straight line.','移动滑块改变初始温度、室温和冷却系数。观察曲线弯曲：相同时间内的降温越来越小，与直线不同。'),
   demo:{kind:'model',title:bi('Newton cooling explorer','牛顿冷却探索器'),
    claim:bi('Cooling is not linear: temperature falls fast at first, then slows as it nears room temperature.','冷却不是线性的：开始时降温快，接近室温时逐渐变慢。'),
    assumptions:bi('Constant room temperature; uniform object temperature with no internal gradients; heat loss proportional to the temperature difference; no evaporation, radiation change or heating; units are °C, min and 1/min.','室温恒定；物体温度均匀、无内部梯度；散热速率与温差成正比；无蒸发、辐射变化或额外加热；单位为摄氏度、分钟和 1/分钟。'),
    inputs:[{id:'initial',label:bi('Initial temperature','初始温度'),unit:'°C',min:60,max:100,step:1,value:80},{id:'ambient',label:bi('Room temperature','室温'),unit:'°C',min:10,max:30,step:1,value:20},{id:'rate',label:bi('Cooling coefficient','冷却系数'),unit:'1/min',min:.01,max:.2,step:.01,value:.1}],
    axis:{label:bi('Time','时间'),unit:'min',min:0,max:30},
    outputs:[{id:'temp',label:bi('Temperature','温度'),unit:'°C',expression:'ambient+(initial-ambient)*exp(-rate*x)'}],
    transfer:{question:bi('With the new settings shown, what is the temperature at the marked time? Answer in °C.','在所示新设置下，标记时刻的温度是多少？以 °C 作答。'),values:[{id:'initial',value:90},{id:'ambient',value:15},{id:'rate',value:.05}],at:10,output:'temp'}}}]}},
 {id:'pendulum',kind:'model',source:'muse',
  summary:bi('Does a heavier bob swing more slowly? Compare the small-angle period against length, gravity and mass.','更重的摆锤摆得更慢吗？比较小角度周期随摆长、重力和质量的变化。'),
  lesson:{version:2,title:bi('Ideal pendulum timing','理想单摆计时'),intro:bi('How does a simple pendulum keep time as its length changes, and does the mass matter?','单摆的计时如何随摆长变化？质量有影响吗？'),chapters:[{experiment:'generated',
   framing:bi('Two pendulums have the same string length but different bob masses. Decide how their periods compare before testing.','两个单摆摆长相同，摆锤质量不同。检验前先判断它们的周期如何比较。'),
   explanation:bi('The curve shows how the period changes with length for the chosen gravity. Move the mass slider while keeping the length fixed to test whether mass matters.','曲线显示在所选重力加速度下周期随摆长变化。固定摆长并移动质量滑块，检验质量是否有影响。'),
   demo:{kind:'model',title:bi('Small-angle pendulum period','小角度单摆周期'),
    claim:bi('At equal length, a heavier bob has the same period as a lighter bob.','在摆长相等时，较重摆锤与较轻摆锤的周期相同。'),
    assumptions:bi('Ideal small-angle model: swing angle near zero so sin θ ≈ θ; massless inextensible string; point bob; no air drag or pivot friction; constant g; length measured from pivot to centre; units m, s, m/s² and kg. The mass slider only tests dependence.','理想小角度模型：摆角接近于零，sin θ ≈ θ；弦无质量且不可伸长；摆锤为质点；无空气阻力和摩擦；重力加速度恒定；长度为悬点到质心；单位为米、秒、米每二次方秒和千克。质量滑块仅用于检验相关性。'),
    inputs:[{id:'gravity',label:bi('Gravity','重力加速度'),unit:'m/s²',min:9,max:10,step:.1,value:9.8},{id:'mass',label:bi('Bob mass','摆锤质量'),unit:'kg',min:.5,max:2,step:.1,value:1}],
    axis:{label:bi('Length','长度'),unit:'m',min:.25,max:4},
    outputs:[{id:'period',label:bi('Period','周期'),unit:'s',expression:'2*pi*sqrt(x/gravity)+0*mass'}],
    transfer:{question:bi('With the new settings shown, what is the period at the marked length? Answer in seconds.','在所示新设置下，标记摆长处的周期是多少？以秒作答。'),values:[{id:'gravity',value:9.8},{id:'mass',value:2}],at:2,output:'period'}}}]}},
 {id:'web-cache',kind:'process',source:'muse',
  summary:bi('Step through how a browser decides between a cached page, a conditional revalidation and a full download.','逐步了解浏览器如何在缓存页面、条件再验证和完整下载之间做出决定。'),
  lesson:{version:2,title:bi('Loading a web page with a cache','使用缓存加载网页'),intro:bi('Why do some page loads feel instant while others contact the network? Explore how cache freshness and revalidation control the steps.','为什么有的页面加载极快，有的却需要联网？来看看缓存新鲜度与再验证如何决定加载步骤。'),chapters:[{experiment:'generated',
   framing:bi('Follow the browser decision path from cache check to reuse or refetch when opening a page.','跟随浏览器打开页面时的决策路径：从缓存检查到复用或重新获取。'),
   explanation:bi('Freshness decides whether the cache can answer alone. Validators support efficient revalidation. Network steps are conditional, so the path differs for fresh, revalidated and fully fetched loads.','新鲜度决定缓存能否独立应答，验证器支持高效再验证。网络步骤是有条件的，因此新鲜命中、再验证命中与完整获取的路径各不相同。'),
   demo:{kind:'process',title:bi('Loading a page with an HTTP cache','使用 HTTP 缓存加载网页'),
    claim:bi('A fresh cache entry avoids networking; an expired entry can be revalidated, and a 304 lets the browser reuse the stored body.','新鲜的缓存条目可避免网络请求；过期的条目可条件再验证，收到 304 后浏览器可复用已存正文。'),
    assumptions:bi('Simplified HTTP caching model using freshness lifetime and validators such as ETag. 304 means the body is unchanged and the cached body is reused. DNS lookup and connection setup happen only when a network request is needed and no cached address or reusable connection exists. Order is logical, not measured time.','采用简化的 HTTP 缓存模型：新鲜期加验证器（如 ETag）。304 表示正文未改变，可复用缓存正文。只有需要网络请求且没有缓存地址或可复用连接时，才进行 DNS 查询与连接。顺序为逻辑顺序，而非实测耗时。'),
    stages:[
     {title:bi('1. Check the local cache first','1. 先检查本地缓存'),detail:bi('The browser looks for a stored response for the URL and checks its freshness rules before any networking.','在发起任何网络请求之前，浏览器先查找该 URL 的已存响应，并检查其新鲜度规则。')},
     {title:bi('2. Fresh hit: no network','2. 新鲜命中：无需网络'),detail:bi('If the entry is still fresh, the browser serves the stored body immediately with no DNS lookup, connection or request.','若条目仍然新鲜，浏览器直接使用已存正文，无需 DNS、连接或请求。')},
     {title:bi('3. DNS and connection only if needed','3. 仅在需要时 DNS 与连接'),detail:bi('If no fresh entry can serve the page, the browser resolves the host unless an address is cached, and opens a connection unless one can be reused.','若没有可用的新鲜条目，浏览器在没有缓存地址时解析域名，在无可复用连接时建立连接。')},
     {title:bi('4. Revalidate an expired entry','4. 对过期条目再验证'),detail:bi('For an expired entry with a validator, the browser sends a conditional request asking whether the stored version is still current.','对于带有验证器的过期条目，浏览器发送条件请求，询问已存版本是否仍然有效。')},
     {title:bi('5. Reuse the body or use the new response','5. 复用正文或使用新响应'),detail:bi('On 304 Not Modified the browser reuses the cached body; on a full new response it replaces the cache entry and renders the new body.','收到 304 未修改时，浏览器复用缓存正文；收到全新响应时，则替换缓存条目并渲染新正文。')}],
    transfer:{question:bi('A page was cached with a validator and is now expired, but the server content probably did not change. What should the browser do?','某页面缓存带有验证器，现已过期，但服务器内容可能未变。浏览器应如何处理？'),
     choices:[bi('Download the full body again without any validation.','不做任何验证，直接重新下载完整正文。'),bi('Send a conditional request and reuse the body if 304 is returned.','发送条件请求，若返回 304 则复用已存正文。'),bi('Always repeat DNS and connection even with a fresh cache hit.','即使新鲜缓存命中，也每次重复 DNS 与连接。')],answer:1,
     rationale:bi('An expired but validated entry should be conditionally revalidated; 304 means reuse the stored body without downloading it again.','过期但有验证器的条目应条件再验证；返回 304 即表示复用已存正文，无需重新下载。')}}}]}},
 {id:'vehicle',kind:'catalog',source:'catalog',
  summary:bi('Three checked physics experiments: equal final speed but different distance, a controlled sideways roll, and the peak force of a powered landing.','三个经过核验的物理实验：末速度相同但距离不同、受控侧向翻滚，以及动力着陆的峰值力。'),
  lesson:{version:1,title:bi('Acceleration, roll and landing','加速度、翻滚与着陆'),intro:bi('Three claims about a hypothetical powered vehicle, each tested against a separate checked calculation.','关于一辆假想动力车辆的三个观点，各自用独立的核验计算检验。'),chapters:[
   {experiment:'acceleration',framing:bi('Two cars start from rest and reach the same speed in the same time, but one accelerates steadily and the other builds up late.','两辆车从静止出发，在相同时间达到相同速度，但一辆匀加速，另一辆后程加速。'),explanation:bi('Distance is the area under the velocity curve, so the same end speed can hide different distances.','距离是速度曲线下的面积，相同的末速度可能对应不同的距离。')},
   {experiment:'roll',framing:bi('An airborne vehicle completes one full sideways turn and comes back upright before landing.','一辆空中的车辆完成一整圈侧向翻滚，在着陆前回到正立姿态。'),explanation:bi('Being upright says nothing about angular speed; only a reversed torque brings the spin to rest.','回到正立并不说明角速度为零；只有反向力矩才能使旋转停止。')},
   {experiment:'landing',framing:bi('Two landings remove the same downward speed, one in a short stop and one in a longer stop.','两次着陆消除相同的向下速度，一次制停很短，一次制停较长。'),explanation:bi('Equal impulse does not mean equal peak force; a longer stop lowers the peak but needs more travel.','相同冲量不代表相同峰值力；更长的制停降低峰值，但需要更大的距离。')}]}},
 {id:'quantum',kind:'catalog',source:'catalog',
  summary:bi('Interference, Bell correlations and a four-item search on a simulated circuit, with single measurements and 256 fresh shots.','在模拟电路上体验干涉、贝尔关联和四项搜索，可单次测量或独立测量 256 次。'),
  lesson:{version:1,title:bi('Why interference matters to a quantum computer','干涉为何对量子计算机重要'),intro:bi('Three simulated circuits show how amplitudes, not just probabilities, decide what a measurement returns.','三个模拟电路展示决定测量结果的是振幅，而不只是概率。'),chapters:[
   {experiment:'interference',framing:bi('Two paths can reach the same outcome. Decide whether their chances simply add before running the circuit.','两条路径可以到达同一结果。运行电路前，先判断它们的概率是否只是简单相加。'),explanation:bi('Amplitudes with opposite phase cancel, so a second path can make an outcome less likely, not more.','相位相反的振幅会相互抵消，因此第二条路径可能让结果更不可能，而不是更可能。')},
   {experiment:'entanglement',framing:bi('Two qubits are prepared together and then measured separately. Decide whether their results can be independent.','两个量子比特一起制备，然后分别测量。先判断它们的结果是否可以彼此独立。'),explanation:bi('The simulated correlations exceed what a classical mixture of 00 and 11 in the same basis can produce.','模拟得到的关联超过了同一测量基中 00 与 11 经典混合所能产生的程度。')},
   {experiment:'search',framing:bi('One of four items is marked. Decide how many queries an ideal search needs before running it.','四个项目中有一个被标记。运行前先判断理想搜索需要查询几次。'),explanation:bi('Amplitude amplification finds the marked item of four in a single query in this ideal simulation; no hardware or speed advantage is claimed.','在这个理想模拟中，振幅放大只需一次查询就能找到四项中的标记项；不涉及硬件，也不声称速度优势。')}]}},
 // Drafted by Muse from the hand-drawn sketch at /gallery/pendulum-sketch.png (frozen image suite,
 // run of October 28, 2026). Author edits: a duplicated chapter removed, labels capitalised, unit symbol.
 {id:'sketch-pendulum',kind:'model',source:'muse-sketch',image:'/gallery/pendulum-sketch.png',
  summary:bi('Muse read this hand-drawn pendulum sketch and built a lesson from it. Change gravity and test how the period depends on length.','Muse 读取这张手绘单摆草图并据此生成课程。调整重力加速度，检验周期如何随摆长变化。'),
  lesson:{version:2,title:bi('Pendulum sketch: length and swing','单摆草图：摆长与摆动'),intro:bi('A simple pendulum from a sketch: a support, a string of length L, and a round bob on a curved path.','来自草图的单摆：支架、长度为 L 的摆线，以及沿弧线运动的圆形摆锤。'),chapters:[{experiment:'generated',
   framing:bi('The sketch shows a pendulum of length L swinging on an arc. How does the swing period change when L is made longer or shorter?','草图显示一个摆长为 L 的单摆沿圆弧摆动。当 L 变长或变短时，摆动周期如何变化？'),
   explanation:bi('The curve rises ever more slowly because the period is proportional to the square root of L. A longer string means a longer period under small-angle motion.','曲线上升越来越平缓，因为周期与摆长的平方根成正比。在小角度运动中，摆线越长，周期越长。'),
   demo:{kind:'model',title:bi('Pendulum length and period','单摆摆长与周期'),
    claim:bi('For small swings, the period grows with the square root of the length L.','在小角度摆动下，周期随摆长 L 的平方根增大。'),
    assumptions:bi('Point-mass bob, massless inextensible string, small swing angle, no air resistance, uniform gravitational acceleration. L is pivot to bob centre in metres; time in seconds.','质点摆锤、轻质不可伸长摆线、小角度摆动、无空气阻力、重力加速度均匀。L 为悬点到摆锤中心的距离，单位米；时间单位秒。'),
    inputs:[{id:'g',label:bi('Gravitational acceleration','重力加速度'),unit:'m/s²',min:1,max:20,step:.1,value:9.8}],
    axis:{label:bi('Length','摆长'),unit:'m',min:.1,max:2},
    outputs:[{id:'period',label:bi('Period','周期'),unit:'s',expression:'2*pi*sqrt(x/g)'}],
    transfer:{question:bi('What is the period in s at the marked length?','在标记摆长处的周期是多少秒？'),values:[{id:'g',value:10}],at:1,output:'period'}}}]}}
]);
export const galleryIds=Object.freeze(galleryLessons.map(l=>l.id));
export function galleryLesson(id){return galleryLessons.find(l=>l.id===id)??null;}
// Deep link: /#lesson:cooling opens a gallery lesson directly.
export function galleryIdFromHash(hash){const m=/^#lesson:([a-z-]+)$/.exec(hash??'');return m&&galleryIds.includes(m[1])?m[1]:null;}
export function gallerySourceNote(source,language='en'){
 const zh=language==='zh';
 if(source==='muse-sketch')return zh?'由 Meta muse-spark-1.3 根据这张手绘草图起草（2026 年 10 月 28 日，冻结的图片评估），作者审阅并做了小幅编辑后收录。':'Drafted by Meta muse-spark-1.3 from this hand-drawn sketch on October 28, 2026 (frozen image evaluation), then reviewed and lightly edited by the author.';
 return source==='muse'?(zh?'由 Meta muse-spark-1.3 起草（2026 年 10 月 27 日），作者审阅并编辑后收录。':'Drafted by Meta muse-spark-1.3 on October 27, 2026, then reviewed and edited by the author.'):(zh?'作者手写的文字，实验为原有的核验计算。':'Hand-authored text over the existing checked experiments.');
}
