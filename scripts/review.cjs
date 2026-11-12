// يطلع قائمة مراجعة التشكيلات LINEUPS-REVIEW.md
const { LINEUPS } = require("../js/lineups.js");
const lv = { 1: "سهل", 2: "متوسط", 3: "صعب" };
const lab = (c) => c.startsWith("منتخب ") ? "منتخبه: " + c.slice(6) : c.startsWith("جنسية ") ? "جنسيته: " + c.slice(6) : "ناديه وقتها: " + c;
let o = `# مراجعة تشكيلات «من الناقص؟»\n\n${LINEUPS.length} تشكيلة، منها ${LINEUPS.filter((l) => l.saudi).length} من الكرة السعودية (🇸🇦). كل تشكيلة أساسية مأخوذة من جدول التشكيلة في صفحة المباراة على ويكيبيديا أو تقارير المباريات. التلميحات بالترتيب: ناديه وقتها (أو منتخبه/جنسيته لو التشكيلة نادي)، تلميحين، أول حرف. لو لقيت خطأ قل لي رقم التشكيلة.\n\n`;
LINEUPS.forEach((l, i) => {
  o += `## ${i + 1}. ${l.saudi ? "🇸🇦 " : ""}${l.title} (${lv[l.level]})\n${l.sub} · ${l.formation}\n\n- المخفي: **${l.name}**\n- التلميحات: ${lab(l.club)} · ${l.extra.map((h) => h[0] + ": " + h[1]).join(" · ")}\n- التشكيلة: ${l.players.map((p) => p.name).join("، ")}\n\n`;
});
o += "ملاحظة: تشكيلة الهلال ضد مانشستر سيتي ٢٠٢٥ أخذتها من bolavip، وتوزيع المراكز فيها تقريبي.\n";
require("fs").writeFileSync("LINEUPS-REVIEW.md", o);
