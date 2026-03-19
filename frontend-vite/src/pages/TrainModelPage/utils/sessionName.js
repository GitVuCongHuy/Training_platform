// TrainModelPage/utils/sessionName.js

export function getRowSessionName(row) {
  return (
    row.session_name ||
    row.training_session_name ||
    row.train_session_name ||
    row.session ||
    ""
  );
}

export function parseSessionName(name) {
  if (!name || typeof name !== "string") return null;
  const regex = /(.*?)_v(?:ersion)?(\d+)_(cls|det)$/i;
  const m = name.match(regex);
  if (!m) return null;
  return {
    domain: m[1],
    version: Number(m[2]),
    type: m[3].toLowerCase(), 
  };
}
