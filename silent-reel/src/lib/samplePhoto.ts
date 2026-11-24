/** A painted stand-in "product photo" (stoneware mug in window light) so the tool opens working. */
export function makeSamplePhoto(): HTMLCanvasElement {
  const W = 1200,
    H = 1600;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  // Wall: warm plaster with window light from upper left
  const wall = g.createLinearGradient(0, 0, W, H * 0.62);
  wall.addColorStop(0, "#e9e2d6");
  wall.addColorStop(0.55, "#cfc5b6");
  wall.addColorStop(1, "#a99d8c");
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);

  // Window light patch
  g.save();
  g.globalAlpha = 0.35;
  g.translate(W * 0.18, H * 0.08);
  g.rotate(-0.18);
  const win = g.createLinearGradient(0, 0, 520, 760);
  win.addColorStop(0, "#fffaf0");
  win.addColorStop(1, "rgba(255,250,240,0)");
  g.fillStyle = win;
  g.fillRect(0, 0, 230, 760);
  g.fillRect(270, 0, 230, 760);
  g.restore();

  // Table: oak slab
  const tableY = H * 0.62;
  const table = g.createLinearGradient(0, tableY, 0, H);
  table.addColorStop(0, "#8a6a4c");
  table.addColorStop(0.12, "#7a5a3e");
  table.addColorStop(1, "#4b3524");
  g.fillStyle = table;
  g.fillRect(0, tableY, W, H - tableY);
  // grain
  g.globalAlpha = 0.12;
  g.strokeStyle = "#2c1d12";
  for (let i = 0; i < 46; i++) {
    const y = tableY + 20 + i * 14 + Math.sin(i * 1.7) * 6;
    g.lineWidth = 1 + (i % 3);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(W * 0.3, y + 10 * Math.sin(i), W * 0.7, y - 12 * Math.cos(i), W, y + 4);
    g.stroke();
  }
  g.globalAlpha = 1;
  // table front edge highlight
  g.fillStyle = "rgba(255,235,210,0.25)";
  g.fillRect(0, tableY, W, 6);

  // Mug geometry
  const cx = W * 0.5,
    mugTop = H * 0.43,
    mugBot = H * 0.69,
    rx = 210,
    ry = 52;

  // Contact shadow
  const sh = g.createRadialGradient(cx + 60, mugBot + 10, 20, cx + 60, mugBot + 10, 380);
  sh.addColorStop(0, "rgba(20,12,6,0.55)");
  sh.addColorStop(1, "rgba(20,12,6,0)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(cx + 70, mugBot + 8, 360, 70, 0, 0, Math.PI * 2);
  g.fill();

  // Handle
  g.lineWidth = 46;
  g.strokeStyle = "#566a63";
  g.beginPath();
  g.ellipse(cx + rx + 10, (mugTop + mugBot) / 2 - 10, 88, 110, 0, -Math.PI / 2.2, Math.PI / 2.2);
  g.stroke();
  g.lineWidth = 14;
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.stroke();

  // Body
  const body = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
  body.addColorStop(0, "#9fb1a8");
  body.addColorStop(0.28, "#7f958c");
  body.addColorStop(0.7, "#4d5f59");
  body.addColorStop(1, "#33413d");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx - rx, mugTop);
  g.lineTo(cx - rx + 14, mugBot - 20);
  g.quadraticCurveTo(cx - rx + 20, mugBot + ry * 0.7, cx, mugBot + ry * 0.75);
  g.quadraticCurveTo(cx + rx - 20, mugBot + ry * 0.7, cx + rx - 14, mugBot - 20);
  g.lineTo(cx + rx, mugTop);
  g.closePath();
  g.fill();

  // Glaze speckle
  for (let i = 0; i < 900; i++) {
    const a = Math.random();
    const x = cx - rx + 20 + Math.random() * (rx * 2 - 40);
    const y = mugTop + 20 + Math.random() * (mugBot - mugTop);
    g.fillStyle = a > 0.5 ? "rgba(30,24,18,0.35)" : "rgba(240,236,226,0.25)";
    g.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2);
  }
  // Raw clay foot
  g.fillStyle = "#b48a62";
  g.beginPath();
  g.moveTo(cx - rx + 16, mugBot - 26);
  g.quadraticCurveTo(cx - rx + 20, mugBot + ry * 0.7, cx, mugBot + ry * 0.75);
  g.quadraticCurveTo(cx + rx - 20, mugBot + ry * 0.7, cx + rx - 16, mugBot - 26);
  g.quadraticCurveTo(cx, mugBot + 6, cx - rx + 16, mugBot - 26);
  g.fill();

  // Specular streak
  const spec = g.createLinearGradient(cx - rx + 40, 0, cx - rx + 120, 0);
  spec.addColorStop(0, "rgba(255,255,255,0)");
  spec.addColorStop(0.5, "rgba(255,255,255,0.35)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = spec;
  g.fillRect(cx - rx + 40, mugTop + 30, 80, mugBot - mugTop - 60);

  // Rim and coffee
  g.fillStyle = "#c9d3cd";
  g.beginPath();
  g.ellipse(cx, mugTop, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  const coffee = g.createRadialGradient(cx - 40, mugTop - 10, 10, cx, mugTop, rx);
  coffee.addColorStop(0, "#6b4126");
  coffee.addColorStop(1, "#2a160a");
  g.fillStyle = coffee;
  g.beginPath();
  g.ellipse(cx, mugTop + 6, rx - 20, ry - 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,240,220,0.35)";
  g.beginPath();
  g.ellipse(cx - 60, mugTop + 2, 50, 9, -0.1, 0, Math.PI * 2);
  g.fill();

  // Soft film grain over everything
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return c;
}
