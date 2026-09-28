export const GENES = [
  { key:'photo', name:'光能利用', color:'#8eda9b' },
  { key:'chemo', name:'化能利用', color:'#e5be71' },
  { key:'hunt', name:'捕食倾向', color:'#f49382' },
  { key:'move', name:'运动能力', color:'#7cbcec' },
  { key:'armor', name:'防御投入', color:'#b8afe5' },
  { key:'social', name:'协作倾向', color:'#9ce5d1' },
  { key:'heat', name:'适温偏好', color:'#dd9678' },
  { key:'tolerance', name:'环境耐受', color:'#c4c78b' },
  { key:'fertility', name:'繁殖投入', color:'#e8a4c2' },
  { key:'sense', name:'感知能力', color:'#80c6d5' },
  { key:'land', name:'陆生适应', color:'#a5be87' },
  { key:'plastic', name:'行为可塑性', color:'#c6a7e5' },
];
// The graph specifies construction constraints, not a real phylogeny or prescribed route.
export const TRAITS = [
 {"id":"pigment","name":"光合色素","stage":0,"lane":"energy","parents":[],"gene":0,"min":0.3,"cost":0.009,"mods":{"photo":0.5},"shape":"膜内采光颗粒或成熟叶面","effect":"光能效率 +50%","description":"提高光能转化效率，但无法超过所在栖息格的剩余光通量。遮蔽与拥挤会削弱收益。","kind":"real"},
 {"id":"vent","name":"化能酶系","stage":0,"lane":"energy","parents":[],"gene":1,"min":0.3,"cost":0.009,"mods":{"mineral":0.5},"shape":"体内化能颗粒","effect":"化学能源摄取速率 +50%","description":"强化热泉化学能源的摄取；合成同时受化学能源与溶解养分限制。","kind":"real"},
 {"id":"flagella","name":"鞭毛推进","stage":0,"lane":"motion","parents":[],"gene":3,"min":0.3,"cost":0.009,"mods":{"speed":0.45},"shape":"长鞭毛与波动尾丝","effect":"基础速度 +45%","description":"增加持续推进速度，使个体更快离开贫瘠栖息地；鞭毛的维护需要能量。","kind":"real"},
 {"id":"shell","name":"保护外膜","stage":0,"lane":"defense","parents":[],"gene":4,"min":0.3,"cost":0.01,"mods":{"defense":0.22},"shape":"整合在身体表面的保护膜","effect":"防御系数 +0.22","description":"保护膜提高抗捕食能力，是多种防御结构的构建起点。","kind":"real"},
 {"id":"vacuole","name":"储能液泡","stage":0,"lane":"reproduction","parents":[],"gene":8,"min":0.25,"cost":0.007,"mods":{"storage":16},"shape":"体内储能囊腔","effect":"储能容量 +16","description":"提高能量储存上限，允许个体积攒更多能量度过资源低谷。","kind":"real"},
 {"id":"cilia","name":"纤毛环带","stage":1,"lane":"motion","parents":["flagella"],"gene":3,"min":0.32,"cost":0.01,"mods":{"turn":0.3,"filter":0.03},"shape":"沿体表摆动的短纤毛","effect":"转向系数 +0.3；浮游有机物摄取 +0.03","description":"提高转向响应，并从水体中摄取少量浮游有机物。与长鞭毛的持续推进互补。","kind":"real"},
 {"id":"engulf","name":"吞噬结构","stage":1,"lane":"energy","parents":["flagella"],"gene":2,"min":0.3,"cost":0.012,"mods":{"hunt":0.045,"digest":0.12},"shape":"可张合的吞噬口","effect":"捕获概率 +0.045；猎物转化率 +0.12","description":"提高捕获其他物种的概率和消化收益；摄食依据体型与能力；可识别近邻降低捕食倾向。","kind":"real"},
 {"id":"symbiosis","name":"光合协作","stage":1,"lane":"energy","parents":["pigment"],"gene":5,"min":0.3,"cost":0.014,"mods":{},"shape":"体内共生胞与色素","effect":"可识别近邻提升光合转化，上限 +60%","description":"附近可识别个体帮助提升光合转化。这里模拟邻域合作收益，未模拟体内共生伙伴。","kind":"real"},
 {"id":"colony","name":"细胞群落","stage":1,"lane":"body","parents":["shell"],"gene":5,"min":0.3,"cost":0.014,"mods":{},"shape":"半透明连接细胞簇","effect":"近邻每增加一个，温度压力分母 +0.12","description":"可识别近邻分担温度压力。聚集也会加剧同一栖息格内的资源竞争。","kind":"real"},
 {"id":"spore","name":"休眠孢子","stage":1,"lane":"reproduction","parents":["shell"],"gene":7,"min":0.3,"cost":0.008,"mods":{},"shape":"带孔休眠包膜","effect":"能量低且食物不足时休眠，消耗降至18%","description":"低能量且附近可利用食物不足时休眠；大幅减少消耗，同时停止移动、进食与繁殖。","kind":"real"},
 {"id":"chemoreceptor","name":"化学感受","stage":1,"lane":"sense","parents":["vent"],"gene":9,"min":0.28,"cost":0.009,"mods":{"chemical":0.55},"shape":"成簇化学感受须","effect":"矿物线索权重 +55%","description":"在比较移动方向时，更重视矿物浓度差异。感受器持续消耗维护能量。","kind":"real"},
 {"id":"eyespot","name":"感光眼点","stage":1,"lane":"sense","parents":["pigment"],"gene":9,"min":0.28,"cost":0.009,"mods":{"photosense":0.6},"shape":"红色感光眼斑","effect":"光照线索权重 +60%","description":"在选择移动方向时更敏感地响应光照，不等同于能够看清猎物的成像眼。","kind":"real"},
 {"id":"mucus","name":"黏液护层","stage":1,"lane":"defense","parents":["shell"],"gene":7,"min":0.3,"cost":0.011,"mods":{"defense":0.1,"land":0.12,"speed":-0.08},"shape":"包围身体的透明黏液层","effect":"防御系数 +0.1；陆生适应 +0.12；基础速度 -8%","description":"提高防御和离水适应能力，同时降低移动速度。","kind":"real"},
 {"id":"filter","name":"滤食冠","stage":2,"lane":"energy","parents":["cilia"],"gene":1,"min":0.3,"cost":0.017,"mods":{"filter":0.16,"speed":-0.12},"shape":"扇状滤食纤毛冠","effect":"浮游有机物摄取 +0.16；基础速度 -12%","description":"以较低速度换取有限浮游有机物的摄取能力，陆地上的效率明显降低。","kind":"real"},
 {"id":"detritus","name":"腐屑摄食","stage":2,"lane":"energy","parents":["engulf"],"gene":1,"min":0.3,"cost":0.012,"mods":{"detritus":0.2},"shape":"腹侧刷状摄食器","effect":"残骸摄取 +0.2","description":"摄取死亡个体留下的残骸；没有残骸时仍需维护摄食结构。","kind":"real"},
 {"id":"oxygen","name":"有氧代谢","stage":2,"lane":"energy","parents":["engulf"],"gene":1,"min":0.3,"cost":0.017,"mods":{},"shape":"体内呼吸颗粒（解剖可见）","effect":"化能与有机物同化系数增加 0.22 × 氧丰度；猎物增加 0.14 × 氧丰度","description":"环境氧气越丰富，同化效率越高。化能、浮游物与残骸转化率最高 96%，猎物最高 90%，没有额外创造能量。","kind":"real"},
 {"id":"tissue","name":"组织分工","stage":2,"lane":"body","parents":["colony"],"gene":5,"min":0.38,"cost":0.019,"mods":{},"shape":"外膜包覆的连通组织","effect":"每个近邻防御 +0.035，上限 +0.25","description":"可识别近邻越多，组织协作带来的防御越高，增益存在上限。","kind":"real"},
 {"id":"bilateral","name":"两侧对称","stage":2,"lane":"body","parents":["tissue"],"gene":3,"min":0.3,"cost":0.009,"mods":{"turn":0.1,"speed":0.12},"shape":"头尾分化的两侧对称躯体","effect":"转向系数 +0.1；基础速度 +12%","description":"前后轴和两侧结构提高定向运动与转向能力，与本模型中的辐射体制互斥。","kind":"real","excludes":["radial"]},
 {"id":"radial","name":"辐射对称","stage":2,"lane":"body","parents":["tissue"],"gene":9,"min":0.3,"cost":0.009,"mods":{"sense":0.22,"speed":-0.1},"shape":"遗传重复参数控制的辐射体盘","effect":"感知半径 +22%；基础速度 -10%","description":"扩大感知范围，以较慢推进换取全周分布的感受与附肢结构。","kind":"real","excludes":["bilateral"]},
 {"id":"root","name":"固着网络","stage":2,"lane":"habitat","parents":["symbiosis"],"gene":0,"min":0.35,"cost":0.016,"mods":{"photo":0.35,"speed":-0.4},"shape":"向基底伸展的分叉根丝","effect":"光能效率 +35%；基础速度 -40%","description":"固着结构减慢运动，同时扩大光能利用效率；仍与邻居共享有限光资源。","kind":"real"},
 {"id":"nerve","name":"神经感知","stage":2,"lane":"sense","parents":["engulf"],"gene":9,"min":0.35,"cost":0.018,"mods":{"sense":0.7},"shape":"体内神经索与节点（解剖可见）","effect":"感知半径 +70%","description":"扩大邻域感知范围，使个体能够依据更远处的生物和环境线索选择方向。","kind":"real"},
 {"id":"spines","name":"防御棘刺","stage":2,"lane":"defense","parents":["shell"],"gene":4,"min":0.35,"cost":0.014,"mods":{"defense":0.18,"speed":-0.08},"shape":"环体向外的尖刺","effect":"防御系数 +0.18；基础速度 -8%","description":"降低被捕获的概率，同时增加运动阻力。","kind":"real"},
 {"id":"toxin","name":"毒素腺体","stage":2,"lane":"defense","parents":["vent"],"gene":4,"min":0.35,"cost":0.017,"mods":{"poison":0.32},"shape":"紫色毒囊与导管","effect":"攻击者额外能耗 +0.32","description":"被捕食尝试命中时让攻击者额外付出能量。制造毒素需要持续维护。","kind":"real"},
 {"id":"budding","name":"出芽繁殖","stage":2,"lane":"reproduction","parents":["colony"],"gene":8,"min":0.35,"cost":0.014,"mods":{"birthCost":-1,"cooldown":4,"dispersal":-4},"shape":"侧面连接的幼体芽","effect":"亲代生殖支出 -1；繁殖间隔 +4；后代散布半径 -4","description":"降低单次生殖支出，但后代散布更近、繁殖间隔更长。","kind":"real"},
 {"id":"cuticle","name":"抗失水表皮","stage":3,"lane":"habitat","parents":["tissue"],"gene":10,"min":0.3,"cost":0.017,"mods":{"land":0.4},"shape":"整合的防水表面与鳞纹","effect":"陆生适应 +0.4","description":"减少离水带来的能量压力，使陆地栖息更可行。","kind":"real"},
 {"id":"segments","name":"躯体分节","stage":3,"lane":"body","parents":["bilateral"],"gene":3,"min":0.35,"cost":0.016,"mods":{"turn":0.2,"speed":0.14},"shape":"独立起伏的连续体节","effect":"转向系数 +0.2；基础速度 +14%","description":"分节增加推进和转向响应，体节在模型中独立摆动。","kind":"real"},
 {"id":"notochord","name":"弹性脊索","stage":3,"lane":"body","parents":["bilateral"],"gene":3,"min":0.4,"cost":0.019,"mods":{"swim":0.4,"turn":-0.08},"shape":"流线躯体的中轴支撑","effect":"水中速度 +40%；转向系数 -0.08","description":"强化水中推进，代价是转向响应略有下降。","kind":"real"},
 {"id":"bell","name":"脉动伞膜","stage":3,"lane":"body","parents":["radial"],"gene":3,"min":0.32,"cost":0.018,"mods":{"swim":0.28,"filter":0.08,"landSpeed":-0.3},"shape":"透明伞盖与悬垂触丝","effect":"水中速度 +28%；浮游有机物摄取 +0.08；陆地速度 -30%","description":"伞状体增加水中运动和悬浮摄食能力，陆地运动受到限制。","kind":"real"},
 {"id":"mycelium","name":"菌丝网络","stage":3,"lane":"body","parents":["root","detritus"],"gene":1,"min":0.35,"cost":0.018,"mods":{"detritus":0.18,"speed":-0.3},"shape":"树枝状菌丝与孢子囊","effect":"残骸摄取 +0.18；基础速度 -30%","description":"分枝网络强化残骸摄食，进一步降低移动速度。","kind":"real"},
 {"id":"fins","name":"成对鳍叶","stage":3,"lane":"motion","parents":["bilateral"],"gene":3,"min":0.4,"cost":0.017,"mods":{"swim":0.5,"landSpeed":-0.15},"shape":"摆动的胸鳍与尾鳍","effect":"水中速度 +50%；陆地速度 -15%","description":"成对鳍提高水中速度，但在陆地上增加阻力。","kind":"real"},
 {"id":"jet","name":"喷射推进","stage":3,"lane":"motion","parents":["engulf"],"gene":3,"min":0.42,"cost":0.023,"mods":{"swim":0.7,"mineral":-0.1},"shape":"腹侧漏斗与脉动喷水口","effect":"水中速度 +70%；矿物摄取效率 -10%","description":"喷水推进提高水中速度，同时减少矿物摄取投入；这里未模拟流体动力。","kind":"real"},
 {"id":"tentacles","name":"捕食触腕","stage":3,"lane":"energy","parents":["tissue","engulf"],"gene":2,"min":0.35,"cost":0.021,"mods":{"reach":8,"hunt":0.025,"speed":-0.12},"shape":"围口排列、数量和长度可遗传的触腕","effect":"捕食距离 +8；捕获概率 +0.025；基础速度 -12%","description":"扩大捕食距离、提高捕获率，同时增加运动阻力。","kind":"real"},
 {"id":"jaws","name":"对合颚片","stage":3,"lane":"energy","parents":["bilateral","engulf"],"gene":2,"min":0.4,"cost":0.02,"mods":{"hunt":0.05,"digest":0.12},"shape":"可开合的成对硬质颚","effect":"捕获概率 +0.05；猎物转化率 +0.12","description":"提高捕获概率和猎物能量转化，收益取决于附近是否存在其他物种。","kind":"real"},
 {"id":"compound","name":"复眼阵列","stage":3,"lane":"sense","parents":["nerve","eyespot"],"gene":9,"min":0.4,"cost":0.019,"mods":{"sense":0.4,"turn":0.12},"shape":"左右成簇的复眼小面","effect":"感知半径 +40%；转向系数 +0.12","description":"复眼扩大感知范围并改善转向响应，眼部小面随结构生成。","kind":"real"},
 {"id":"antennae","name":"触角定位","stage":3,"lane":"sense","parents":["nerve","chemoreceptor"],"gene":9,"min":0.35,"cost":0.016,"mods":{"sense":0.28,"chemical":0.4},"shape":"前端弯曲的分节触角","effect":"感知半径 +28%；矿物线索权重 +40%","description":"触角同时强化邻域感知与矿物线索的权重。","kind":"real"},
 {"id":"camouflage","name":"变色伪装","stage":3,"lane":"defense","parents":["eyespot","shell"],"gene":11,"min":0.35,"cost":0.016,"mods":{"conceal":0.25,"hunt":0.01},"shape":"依附体表的低对比斑纹","effect":"隐蔽 +25%；捕获概率 +0.01","description":"降低捕食者的捕获成功率，并略微提高自身捕获机会；花纹是示意，并未匹配地形颜色。","kind":"real"},
 {"id":"carapace","name":"硬质甲壳","stage":3,"lane":"defense","parents":["spines","tissue"],"gene":4,"min":0.42,"cost":0.022,"mods":{"defense":0.24,"speed":-0.2},"shape":"贴合躯干的叠压背甲","effect":"防御系数 +0.24；基础速度 -20%","description":"硬质外壳提供更高防御，代价是移动减慢。","kind":"real"},
 {"id":"eggs","name":"卵囊保护","stage":3,"lane":"reproduction","parents":["spore","tissue"],"gene":8,"min":0.35,"cost":0.017,"mods":{"childEnergy":2,"birthCost":2,"juvenile":0.18},"shape":"腹侧育幼结构（解剖可见）","effect":"出生能量 +2；亲代生殖支出 +2；幼年防御 +0.18","description":"提高子代出生能量与幼年防御；额外能量由亲代支付。","kind":"real"},
 {"id":"dispersal","name":"远距散播","stage":3,"lane":"reproduction","parents":["spore","flagella"],"gene":8,"min":0.35,"cost":0.016,"mods":{"dispersal":30,"childEnergy":-1},"shape":"放射状绒羽与孢子粒","effect":"后代散布半径 +30；出生能量 -1","description":"后代在更远的位置出生，更容易进入新栖息地，但出生储备减少。","kind":"real"},
 {"id":"gills","name":"薄片鳃","stage":3,"lane":"habitat","parents":["tissue","oxygen"],"gene":7,"min":0.35,"cost":0.018,"mods":{"water":0.025},"shape":"两侧层叠的红色鳃丝","effect":"水中转化系数×氧丰度 +0.025","description":"在水中随氧气丰度提高资源转化。它与气腔可以共存，但都需要维护。","kind":"real"},
 {"id":"osmotic","name":"渗透调节","stage":3,"lane":"habitat","parents":["vacuole","shell"],"gene":7,"min":0.35,"cost":0.014,"mods":{"land":0.18,"tolerance":4},"shape":"成对的调节腔与体表孔","effect":"陆生适应 +0.18；耐温宽度 +4","description":"扩大温度耐受范围并提高陆生适应；此处未单独模拟盐度。","kind":"real"},
 {"id":"memory","name":"空间记忆","stage":4,"lane":"sense","parents":["nerve"],"gene":11,"min":0.35,"cost":0.021,"mods":{},"shape":"更密集的内部感知节点","effect":"记住高收益位置 160 时步","description":"记录近期高摄食收益的位置，食物不足时以该记忆辅助寻找方向。","kind":"real"},
 {"id":"camera","name":"透镜眼","stage":4,"lane":"sense","parents":["nerve","eyespot","tissue"],"gene":9,"min":0.45,"cost":0.024,"mods":{"sense":0.65,"hunt":0.015},"shape":"具虹膜与黑色瞳孔的双眼","effect":"感知半径 +65%；捕获概率 +0.015","description":"透镜眼扩大感知范围并提高捕获率，维护成本高于简单眼点。","kind":"real"},
 {"id":"electro","name":"电场感受","stage":4,"lane":"sense","parents":["antennae"],"gene":9,"min":0.4,"cost":0.022,"mods":{"sense":0.3,"hunt":0.018},"shape":"蓝白色电感受孔列","effect":"感知半径 +30%；捕获概率 +0.018","description":"以电感受器为形态灵感扩大感知、提高捕获率，未模拟真实电场。","kind":"real"},
 {"id":"limbs","name":"关节步足","stage":4,"lane":"motion","parents":["segments","cuticle"],"gene":3,"min":0.4,"cost":0.024,"mods":{"landSpeed":0.8,"swim":-0.15},"shape":"成对屈伸的关节足","effect":"陆地速度 +80%；水中速度 -15%","description":"显著提高陆地移动速度，水中运动则受到附肢阻力影响。","kind":"real"},
 {"id":"flight","name":"滑翔翼膜","stage":4,"lane":"motion","parents":["bilateral","cuticle"],"gene":3,"min":0.45,"cost":0.028,"mods":{"speed":0.3,"landSpeed":0.45},"shape":"张开的半透明脉络翼膜","effect":"基础速度 +30%；陆地速度 +45%","description":"翼膜提高基础迁移与陆地跨越能力；地图中的飞行仍压缩为平面运动。","kind":"real"},
 {"id":"tubeFeet","name":"管足爬行","stage":4,"lane":"motion","parents":["radial","gills"],"gene":3,"min":0.32,"cost":0.016,"mods":{"swim":0.18,"turn":0.2},"shape":"辐射体下方伸缩的管足","effect":"水中速度 +18%；转向系数 +0.2","description":"改善转向和水中爬行速度，管足在辐射躯体下伸缩。","kind":"real"},
 {"id":"canopy","name":"冠层采光","stage":4,"lane":"habitat","parents":["root","cuticle"],"gene":0,"min":0.4,"cost":0.025,"mods":{},"shape":"层叠的叶片与叶脉","effect":"浅海与陆地的光合效率 ×1.6","description":"浅海与陆地中提高光能利用，在深水区没有额外冠层收益。","kind":"real"},
 {"id":"lungs","name":"气腔呼吸","stage":4,"lane":"habitat","parents":["cuticle","oxygen"],"gene":10,"min":0.4,"cost":0.022,"mods":{"air":0.06,"water":-0.012},"shape":"体内双侧气腔（解剖可见）","effect":"陆地转化系数×氧丰度 +0.06；水中转化系数×氧丰度 -0.012","description":"在陆地随氧气丰度提高资源转化，在水中有少量额外负担。","kind":"real"},
 {"id":"insulation","name":"隔热绒被","stage":4,"lane":"habitat","parents":["cuticle"],"gene":7,"min":0.4,"cost":0.021,"mods":{"cold":0.4,"hot":-0.1},"shape":"密集软绒与轮廓毛束","effect":"耐寒 +40%；耐热 -10%","description":"缓解低温压力，但在高温环境下增加散热负担。","kind":"real"},
 {"id":"regeneration","name":"组织再生","stage":4,"lane":"defense","parents":["tissue","vacuole"],"gene":7,"min":0.4,"cost":0.024,"mods":{"lifespan":180,"juvenile":0.12},"shape":"体节边缘明亮的生长环","effect":"衰老起点 +180；幼年防御 +0.12","description":"延后衰老概率开始上升的年龄，并增加幼年防御；未模拟组织损伤修复过程。","kind":"real"},
 {"id":"ink","name":"墨囊遁逃","stage":4,"lane":"defense","parents":["jet","toxin"],"gene":11,"min":0.4,"cost":0.023,"mods":{"conceal":0.35,"speed":0.08},"shape":"深紫色墨囊与排墨管","effect":"隐蔽 +35%；基础速度 +8%","description":"降低被捕获的概率并略微提高移动速度；墨囊用概率规则表达遁逃。","kind":"real"},
 {"id":"brood","name":"护幼行为","stage":4,"lane":"reproduction","parents":["eggs","nerve"],"gene":5,"min":0.4,"cost":0.022,"mods":{"childEnergy":3,"birthCost":3,"juvenile":0.24},"shape":"内部幼体与育幼腔","effect":"出生能量 +3；亲代生殖支出 +3；幼年防御 +0.24","description":"亲代支付额外能量，提高子代能量储备和幼年防御。","kind":"real"},
 {"id":"pheromone","name":"信息素协作","stage":4,"lane":"reproduction","parents":["chemoreceptor","colony"],"gene":5,"min":0.4,"cost":0.018,"mods":{"attract":0.5,"cooldown":-3},"shape":"发光的通信腺与触须","effect":"识别趋近权重 +50%；繁殖间隔 -3","description":"加强对可识别近邻的趋近权重并缩短繁殖间隔，依然必须满足遗传兼容条件。","kind":"real"},
 {"id":"graze","name":"刮食齿舌","stage":4,"lane":"energy","parents":["jaws","detritus"],"gene":1,"min":0.4,"cost":0.02,"mods":{"detritus":0.25,"mineral":0.2,"hunt":-0.018},"shape":"口腔内横列的刮食齿","effect":"残骸摄取 +0.25；矿物摄取效率 +20%；捕获概率 -0.018","description":"加强残骸和矿物摄取，代价是捕获活体猎物的能力略微下降。","kind":"real"},
 {"id":"vascular","name":"输导脉络","stage":5,"lane":"body","parents":["canopy"],"gene":0,"min":0.45,"cost":0.027,"mods":{"photo":0.45,"storage":10},"shape":"沿身体主轴或枝干分布的输导脉络","effect":"光能效率 +45%；储能容量 +10","description":"输导组织提高光能转化和储能容量，模型表现为直立枝干及叶脉。","kind":"real"},
 {"id":"chamber","name":"旋卷外壳","stage":5,"lane":"body","parents":["carapace","jet"],"gene":4,"min":0.45,"cost":0.03,"mods":{"defense":0.2,"swim":0.15,"turn":-0.12},"shape":"旋卷分室壳与壳口触须","effect":"防御系数 +0.2；水中速度 +15%；转向系数 -0.12","description":"分室旋壳增加防御与水中推进，降低转向响应。","kind":"real"},
 {"id":"endoskeleton","name":"内部骨架","stage":5,"lane":"body","parents":["notochord","tissue"],"gene":4,"min":0.4,"cost":0.024,"mods":{"speed":0.22,"defense":0.12},"shape":"脊柱和成对肋骨","effect":"基础速度 +22%；防御系数 +0.12","description":"内部支撑同时改善速度与防御，骨架的维护成本持续存在。","kind":"real"},
 {"id":"poweredFlight","name":"主动振翅","stage":5,"lane":"motion","parents":["flight","oxygen"],"gene":3,"min":0.5,"cost":0.035,"mods":{"landSpeed":0.8,"swim":-0.15},"shape":"带放射脉络、斑纹的主动膜翼","effect":"陆地速度 +80%；水中速度 -15%","description":"进一步提高陆地跨越速度，在水中则承担大型翼面的阻力。","kind":"real"},
 {"id":"endothermy","name":"产热调节","stage":5,"lane":"habitat","parents":["insulation","oxygen"],"gene":7,"min":0.45,"cost":0.028,"mods":{"cold":0.55,"hot":-0.15},"shape":"体内产热核心与绒层","effect":"耐寒 +55%；耐热 -15%","description":"显著降低寒冷压力，同时增加高温负担与日常维护。","kind":"real"},
 {"id":"dormancy","name":"季节蛰伏","stage":5,"lane":"habitat","parents":["spore","memory"],"gene":11,"min":0.4,"cost":0.021,"mods":{"sleepThreshold":0.12},"shape":"闭合的分瓣防护囊","effect":"蛰伏阈值 +0.12","description":"在更广的食物不足条件下蛰伏，帮助节能，也可能错过短暂摄食机会。","kind":"real"},
 {"id":"schooling","name":"同步群游","stage":5,"lane":"reproduction","parents":["memory","pheromone"],"gene":5,"min":0.45,"cost":0.021,"mods":{"kinDefense":0.035,"attract":0.45},"shape":"沿侧线排列的协作信号灯","effect":"每近邻防御 +0.035；识别趋近权重 +45%","description":"可识别个体更容易聚集，近邻提供额外防御；局部资源竞争仍然存在。","kind":"real"},
 {"id":"echolocation","name":"主动回声","stage":5,"lane":"sense","parents":["memory","antennae"],"gene":9,"min":0.45,"cost":0.028,"mods":{"sense":0.75,"hunt":0.018},"shape":"前端声囊与宽阔感受叶","effect":"感知半径 +75%；捕获概率 +0.018","description":"扩大感知范围并提高捕获率，以声囊外形表达；未计算真实声波。","kind":"real"},
 {"id":"biolum","name":"诱饵发光","stage":5,"lane":"energy","parents":["toxin","antennae"],"gene":2,"min":0.4,"cost":0.023,"mods":{"reach":7,"hunt":0.035},"shape":"伸出的发光诱饵杆","effect":"捕食距离 +7；捕获概率 +0.035","description":"扩大有效捕食距离并提高捕获率，以发光诱饵表达；不会凭空产生猎物。","kind":"real"},
 {"id":"mutualism","name":"近邻化能协作","stage":5,"lane":"energy","parents":["mycelium","canopy"],"gene":5,"min":0.4,"cost":0.025,"mods":{"kinMineral":0.08},"shape":"根丝上金绿相间的共生结节","effect":"每近邻化能摄取系数 +0.08","description":"可识别近邻增加化能摄取速率，增益有上限；化学能源与养分仍从共同的有限存量扣除。","kind":"real"},
 {"id":"silica","name":"硅质织构","stage":6,"lane":"fiction","parents":["carapace","osmotic"],"gene":4,"min":0.45,"cost":0.035,"mods":{"defense":0.28,"tolerance":12},"shape":"半透明晶体骨架","effect":"防御系数 +0.28；耐温宽度 +12","description":"科幻结构。大型晶体组织提供高防御与宽温度耐受，需要较高维护投入。","kind":"fiction"},
 {"id":"hive","name":"群体心智","stage":6,"lane":"fiction","parents":["memory","tissue","pheromone"],"gene":5,"min":0.45,"cost":0.036,"mods":{},"shape":"体表小型通信节点","effect":"共享可识别近邻的资源记忆","description":"科幻结构。能够使用附近可识别个体记录的资源位置，形成邻域记忆共享。","kind":"fiction"},
 {"id":"radiant","name":"辐射代谢","stage":6,"lane":"fiction","parents":["canopy","osmotic"],"gene":7,"min":0.45,"cost":0.03,"mods":{},"shape":"体表辐射代谢斑点","effect":"从辐射事件的有限局部辐射通量摄取能量，并减轻辐射压力","description":"科幻结构。辐射事件中摄取有限局部辐射通量，并减轻辐射造成的代谢压力。","kind":"fiction"},
 {"id":"aerostat","name":"生物浮空囊","stage":6,"lane":"fiction","parents":["lungs","flight","vacuole"],"gene":3,"min":0.45,"cost":0.033,"mods":{"landSpeed":1,"land":0.25,"swim":-0.5},"shape":"背部半透明多瓣浮囊","effect":"陆地速度 +100%；陆生适应 +0.25；水中速度 -50%","description":"科幻结构。浮囊显著提高陆地迁移与离水适应，水中运动受到限制。","kind":"fiction"},
 {"id":"crystalSense","name":"晶格感知","stage":6,"lane":"fiction","parents":["silica","electro"],"gene":9,"min":0.5,"cost":0.035,"mods":{"sense":1,"chemical":0.7},"shape":"放射状晶簇触角","effect":"感知半径 +100%；矿物线索权重 +70%","description":"科幻结构。晶格感受器扩大感知范围，并强化化学资源线索。","kind":"fiction"},
 {"id":"thermalBloom","name":"热辐射花冠","stage":6,"lane":"fiction","parents":["endothermy","canopy"],"gene":7,"min":0.5,"cost":0.036,"mods":{"hot":0.65,"photo":0.2},"shape":"红金色散热花冠","effect":"耐热 +65%；光能效率 +20%","description":"科幻结构。花冠改善高温耐受并增加采光效率，以散热结构表达。","kind":"fiction"},
 {"id":"livingReef","name":"共识礁体","stage":6,"lane":"fiction","parents":["hive","root","filter"],"gene":5,"min":0.5,"cost":0.032,"mods":{"filter":0.26,"kinDefense":0.05,"speed":-0.3},"shape":"分枝礁体与末端滤食冠","effect":"浮游有机物摄取 +0.26；每近邻防御 +0.05；基础速度 -30%","description":"科幻结构。固着塔群提高悬浮摄食和邻域防御，运动速度进一步下降。","kind":"fiction"}
];
export const TRAIT_INDEX=Object.fromEntries(TRAITS.map((t,i)=>[t.id,i]));
export const has=(a,id)=>a.traits.includes(id);
export const STAGES=['原初适应','细胞革新','组织结构','生态分化','复杂器官','协同策略','异星可能'];
export const LANES={energy:'摄食与代谢',body:'体制结构',motion:'运动方式',sense:'感知与行为',defense:'防御与生存',reproduction:'繁殖与协作',habitat:'环境适应',fiction:'科幻结构'};
export const PALETTE=['#88dfbc','#edb56d','#97b5f6','#e991a9','#c3a3ef','#e0d68c','#75d3e2','#ef9476','#b7d99a','#bcbbc8'];
export const DEFAULTS={seed:'ORIGIN-042',founders:4,temperature:24,light:1,resources:1,sea:.57,mutation:.09,volatility:.3,fiction:true,origin:true};
export function traitClosure(ids){
 const chosen=new Set();
 function add(id){const t=TRAITS[TRAIT_INDEX[id]];for(const p of t.parents)add(p);chosen.add(id);}
 ids.forEach(add);return TRAITS.filter(t=>chosen.has(t.id)).map(t=>t.id);
}
export function phenotype(traits){
 const p={cost:0,photo:0,mineral:0,speed:0,filter:0,turn:0,hunt:0,digest:0,defense:0,storage:0,chemical:0,photosense:0,land:0,detritus:0,sense:0,poison:0,birthCost:0,cooldown:0,dispersal:0,swim:0,landSpeed:0,reach:0,conceal:0,childEnergy:0,juvenile:0,water:0,tolerance:0,air:0,cold:0,hot:0,lifespan:0,attract:0,sleepThreshold:0,kinDefense:0,kinMineral:0};
 for(const id of traits){const t=TRAITS[TRAIT_INDEX[id]];p.cost+=t.cost;for(const [key,value] of Object.entries(t.mods))p[key]+=value;}
 return p;
}
export const SOURCES=[
 {title:'Westram 等：怎样定义生殖隔离',url:'https://research-explorer.ista.ac.at/download/12264/12448/2022_JourEvoBiology_Westram.pdf',note:'遗传差异对基因交流的影响需要结合接触背景；标签或没有相遇本身不能证明隔离。'},
 {title:'SLiM：个体遗传与非固定世代模型',url:'https://messerlab.org/slim/',note:'繁殖、存活和空间过程的明确建模参照；本沙盒尚未与同假设的SLiM实验逐项校准。'},
 {title:'Karl Sims：演化虚拟生物',url:'https://www.karlsims.com/papers/siggraph94.pdf',note:'身体布局与连接表面的设计参考；本沙盒没有使用其外部目标评分来指定自然演化路线。'},
 {title:'Dingle 等：变异供给的偏置',url:'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011893',note:'可达性与发育规则本身会影响结果；同率增减尝试仍不代表无偏的形态空间。'},
 {title:'ODD：个体模拟的说明规范',url:'https://www.jasss.org/23/2/7.html',note:'明确模型目的、过程、假设、参数和可复现实验，区分实现检查与现实验证。'},
 {title:'Kooi 等：营养回收与生态系统的质量平衡',url:'https://www.bio.vu.nl/thb/research/bib/KooiPogg2002.pdf',note:'能量与养分的显式收支、残骸回收。统一养分比例与具体常数是本沙盒的简化。'},
 {title:'Petchey 等：体型、觅食与食物网结构',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC2393804/',note:'体型匹配、摄食收益与处理时间影响食物网；这里没有拟合真实生态数据。'},
 {title:'Loeuille 与 Loreau：食物网结构的演化',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC556288/',note:'体型相关摄食与生态反馈可以共同塑造演化的食物网。'},
 {title:'Gras 等：个体驱动的演化捕食生态系统',url:'https://strathprints.strath.ac.uk/90261/',note:'局部感知、个体状态与遗传行为的设计依据；本沙盒采用简单启发式决策。'},
 {title:'Dagre：有向图分层布局',url:'https://github.com/dagrejs/dagre/wiki',note:'用于性状前置图和实际亲缘树的自动布局。'},
 {title:'Berkeley：理解亲缘分支',url:'https://evolution.berkeley.edu/evolution-101/the-history-of-life-looking-at-the-patterns/understanding-phylogenies/',note:'记录共同祖先和真实分叉；相似形态不等于较近亲缘。'},
 {title:'Thrive：宏观编辑器设计讨论',url:'https://forum.revolutionarygamesstudio.com/t/macroscopic-editor-progression-and-principles/943',note:'身体主轴、附肢和体表部件分离的设计参考；这是一份设计讨论。'},
 {title:'Avida：生态与突变顺序导致的物种形成',url:'https://www.journals.uchicago.edu/doi/full/10.1086/674359',note:'借鉴个体遗传、基因交叉、突变与差异繁殖；生殖隔离在这里使用抽象判据。'},
 {title:'Thrive：官方 Auto-Evo 文档',url:'https://github.com/Revolutionary-Games/Thrive/blob/master/doc/auto_evo.md',note:'借鉴资源生态位和相对竞争。本沙盒的突变无方向，不使用其定向优化策略。'},
 {title:'Lenia：大规模开放式演化实验',url:'https://arxiv.org/html/2304.05639',note:'能量、空间和环境约束有助于维持生态差异，但不保证无限演化。'},
 {title:'数字微观世界中的生命起源',url:'https://arxiv.org/abs/1701.03993',note:'初始复制者的结构影响后续演化。本沙盒将生命起源简化为复制者的生成。'},

 {title:'Thrive：细胞结构与功能',url:'https://wiki.revolutionarygamesstudio.com/wiki/Help_And_Tips',note:'纤毛、鞭毛、感受器、液泡与毒素提供模块化器官设计参考。'},
 {title:'OpenStax：动物形态与功能',url:'https://openstax.org/books/biology-2e/pages/33-1-animal-form-and-function',note:'对称性、体形、骨架与能量取舍；本图谱的前置关系是游戏规则，不表示真实祖先关系。'},
 {title:'Smithsonian：头足类',url:'https://ocean.si.edu/ocean-life/invertebrates/octopuses-squids-and-relatives',note:'触腕、喷射、伪装和感知结构的形态参考。'},
 {title:'Berkeley：物种形成的原因',url:'https://evolution.berkeley.edu/evolution-101/speciation/causes-of-speciation/',note:'隔离、基因流与分化；本模型采用简化的交配网络与差异阈值。'},
];
