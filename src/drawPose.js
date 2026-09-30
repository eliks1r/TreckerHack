import { VISIBILITY_THRESHOLD } from "./config.js";

// Main body connections; facial landmarks are drawn as points without a mesh.
const BODY_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [16, 18], [16, 20], [16, 22], [18, 20],
];

const visible = (point) => point &&
  Number.isFinite(point.x) && Number.isFinite(point.y) &&
  (point.visibility ?? 1) >= VISIBILITY_THRESHOLD;

export function sizePoseCanvas(canvas, video) {
  if (video.videoWidth && video.videoHeight &&
      (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

export function clearPose(canvas) {
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

export function drawPose(canvas, landmarks, quality, activeError = null) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks || !canvas.width || !canvas.height) return;

  // Athletic Electric Lime & Crimson palette matching MOTION Figma design
  const color = quality?.framing === "READY"
    ? "#D4FF00"
    : quality && quality.framing !== "NO_BODY" ? "#FFC24B" : "#FF3B30";

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.lineWidth = Math.max(3.5, canvas.width / 150);
  context.shadowColor = color;
  context.shadowBlur = 12;

  for (const [start, end] of BODY_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!visible(a) || !visible(b)) continue;
    context.beginPath();
    context.moveTo(a.x * canvas.width, a.y * canvas.height);
    context.lineTo(b.x * canvas.width, b.y * canvas.height);
    context.stroke();
  }

  context.shadowBlur = 0;
  for (const [index, point] of landmarks.entries()) {
    if (!visible(point)) continue;
    const isFace = index <= 10;
    const radius = isFace ? Math.max(2, canvas.width / 320) : Math.max(4.5, canvas.width / 170);

    // Outer glowing halo
    if (!isFace) {
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, radius * 1.9, 0, Math.PI * 2);
      context.fillStyle = "rgba(212, 255, 0, 0.28)";
      context.fill();
    }

    // Inner core point
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, radius, 0, Math.PI * 2);
    context.globalAlpha = isFace ? 0.45 : 1;
    context.fillStyle = isFace ? color : "#FFFFFF";
    context.fill();

    if (!isFace) {
      context.lineWidth = 2;
      context.strokeStyle = "#111111";
      context.stroke();
    }
  }
  context.globalAlpha = 1;

  if (activeError?.joints?.length) {
    const highlight = activeError.severity === "critical" ? "#FF3B30" : "#FFC24B";
    context.fillStyle = highlight;
    context.strokeStyle = "#111111";
    context.lineWidth = Math.max(2.5, canvas.width / 280);
    context.shadowColor = highlight;
    context.shadowBlur = 14;
    for (const index of activeError.joints) {
      const point = landmarks[index];
      if (!visible(point)) continue;
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height,
        Math.max(9, canvas.width / 70), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.shadowBlur = 0;
  }
}
