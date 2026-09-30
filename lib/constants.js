export const STAGES = [
  { id: "watch", label: "Watch", hint: "On the radar" },
  { id: "ordered", label: "Ordered", hint: "PO placed" },
  { id: "transit", label: "ETA / In transit", hint: "On the way" },
  { id: "received", label: "Received", hint: "In the back" },
  { id: "shelf", label: "On shelf", hint: "Out on the floor" },
  { id: "advertise", label: "Advertise", hint: "Tell people" },
];

export const STATUSES = STAGES.map((stage) => stage.label);

export const READY_STATUSES = ["Received", "On shelf", "Advertise"];

export const DISTRIBUTORS = ["Alliance", "URP", "Sub Pop"];

export const FORMATS = ["LP", "CD", "Cassette", "7\"", "10\"", "12\"", "Box set"];

export function stageByStatus(status) {
  return STAGES.find((stage) => stage.label === status) || STAGES[0];
}

export function statusIndex(status) {
  const index = STATUSES.indexOf(status);
  return index === -1 ? STATUSES.length : index;
}
