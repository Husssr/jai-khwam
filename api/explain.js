const PROMPT = `คุณเป็นผู้ช่วยอธิบายเอกสารให้คนไทยทุกวัย รวมถึงผู้สูงอายุที่ไม่คุ้นกับภาษาราชการหรือภาษากฎหมาย
กติกา: ใช้ภาษาไทยง่ายๆ ประโยคสั้น อธิบายเฉพาะสิ่งที่มีในเอกสาร ห้ามเดาตัวเลข วันที่ หรือชื่อหน่วยงานที่ไม่ได้ระบุ ถ้าไม่มีให้ใส่ null
ถ้าดูเหมือนข้อความหลอกลวง ให้ตั้ง urgency เป็น "high" และเตือนใน warnings ว่าไม่ควรกดลิงก์หรือโอนเงิน พร้อมบอกวิธีตรวจสอบกับต้นทางจริง
ถ้าไม่ใช่เอกสารหรืออ่านไม่ออก ให้ readable เป็น false
ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น ตามรูปแบบ:
{"readable":true,"doc_type":"ชนิดเอกสารสั้นๆ","urgency":"high|normal|none","summary":"สรุป 1-2 ประโยคว่าเอกสารนี้คืออะไรและเกี่ยวกับผู้อ่านอย่างไร","actions":["สิ่งที่ต้องทำ เรียงตามลำดับ ไม่เกิน 5 ข้อ"],"deadline":"กำหนดเวลาที่ระบุในเอกสาร หรือ null","warnings":["ผลเสียหรือสิ่งที่ต้องระวัง ไม่เกิน 3 ข้อ"],"terms":[{"term":"ศัพท์ยาก","meaning":"ความหมายง่ายๆ"}]}
urgency: high = ต้องรีบทำหรือมีผลเสียถ้าช้า, normal = ทำตามกำหนดปกติ, none = ไม่ต้องทำอะไร`;
// ใช้ Gemini API (Google AI Studio) ตั้งชื่อโมเดลใหม่ได้ที่ Environment Variable ชื่อ GEMINI_MODEL
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { doc = "", image } = req.body || {};
  if (String(doc).length > 8000) return res.status(413).json({ error: "too_long" });
  const parts = [];
  if (image && image.media_type === "image/jpeg" && typeof image.data === "string" && image.data.length < 3_500_000) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: image.data } });
  }
  if (!doc.trim() && !parts.length) return res.status(400).json({ error: "empty" });
  parts.push({ text: PROMPT + (doc.trim() ? "\n\nข้อความในเอกสาร:\n" + doc : "\n\n(เอกสารอยู่ในรูปที่แนบมา)") });
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
    });
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream" });
    const data = await r.json();
    const text = ((data.candidates || [])[0]?.content?.parts || []).map(p => p.text || "").join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return res.status(200).json(json);
  } catch (e) {
    return res.status(502).json({ error: "failed" });
  }
};
