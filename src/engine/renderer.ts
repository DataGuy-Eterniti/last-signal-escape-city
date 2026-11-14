import { VehicleState } from '../types';

export function renderGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vehicle: VehicleState
) {
  // Clear full canvas
  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  // Camera transform: keep vehicle centered on screen
  ctx.translate(width / 2, height / 2);

  // 1. Draw city grid / road environment relative to vehicle position
  const camX = vehicle.x;
  const camY = vehicle.y;

  const gridSize = 80;

  // Subtle background grid
  ctx.strokeStyle = '#141c2e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -width / 2 - (camX % gridSize); x < width / 2; x += gridSize) {
    ctx.moveTo(x, -height / 2);
    ctx.lineTo(x, height / 2);
  }
  for (let y = -height / 2 - (camY % gridSize); y < height / 2; y += gridSize) {
    ctx.moveTo(-width / 2, y);
    ctx.lineTo(width / 2, y);
  }
  ctx.stroke();

  // Major road markings / asphalt lanes
  const laneSpacing = 240;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = -width / 2 - (camX % laneSpacing); x < width / 2; x += laneSpacing) {
    ctx.moveTo(x, -height / 2);
    ctx.lineTo(x, height / 2);
  }
  ctx.stroke();

  // Dashed neon road dividing strips
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 30]);
  ctx.beginPath();
  for (let x = -width / 2 - (camX % laneSpacing) + laneSpacing / 2; x < width / 2; x += laneSpacing) {
    ctx.moveTo(x, -height / 2);
    ctx.lineTo(x, height / 2);
  }
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // 2. Draw Courier Vehicle (Top-Down Procedural Canvas 2D)
  ctx.rotate(vehicle.angle + Math.PI / 2); // 0 angle points right, car model points up

  const carW = 28;
  const carH = 52;

  // Headlight beams
  const gradient = ctx.createRadialGradient(0, -carH / 2, 5, 0, -carH / 2 - 120, 90);
  gradient.addColorStop(0, 'rgba(255, 240, 180, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-10, -carH / 2);
  ctx.lineTo(-50, -carH / 2 - 140);
  ctx.lineTo(50, -carH / 2 - 140);
  ctx.lineTo(10, -carH / 2);
  ctx.closePath();
  ctx.fill();

  // Nitro Thruster Flame
  if (vehicle.nitroActive) {
    ctx.save();
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(-8, carH / 2);
    ctx.lineTo(0, carH / 2 + 25 + Math.random() * 10);
    ctx.lineTo(8, carH / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(-4, carH / 2);
    ctx.lineTo(0, carH / 2 + 15 + Math.random() * 6);
    ctx.lineTo(4, carH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Wheels (4 tires)
  ctx.fillStyle = '#111827';
  // Front-left
  ctx.fillRect(-carW / 2 - 4, -carH / 2 + 6, 5, 12);
  // Front-right
  ctx.fillRect(carW / 2 - 1, -carH / 2 + 6, 5, 12);
  // Rear-left
  ctx.fillRect(-carW / 2 - 4, carH / 2 - 18, 5, 12);
  // Rear-right
  ctx.fillRect(carW / 2 - 1, carH / 2 - 18, 5, 12);

  // Car Body Chassis
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Sleek cyber-courier angular body
  ctx.moveTo(-carW / 2 + 4, -carH / 2);
  ctx.lineTo(carW / 2 - 4, -carH / 2);
  ctx.lineTo(carW / 2, -carH / 2 + 12);
  ctx.lineTo(carW / 2, carH / 2 - 4);
  ctx.lineTo(carW / 2 - 4, carH / 2);
  ctx.lineTo(-carW / 2 + 4, carH / 2);
  ctx.lineTo(-carW / 2, carH / 2 - 4);
  ctx.lineTo(-carW / 2, -carH / 2 + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Windshield & Roof Glass
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(-carW / 2 + 5, -carH / 2 + 14);
  ctx.lineTo(carW / 2 - 5, -carH / 2 + 14);
  ctx.lineTo(carW / 2 - 4, -carH / 2 + 28);
  ctx.lineTo(-carW / 2 + 4, -carH / 2 + 28);
  ctx.closePath();
  ctx.fill();

  // Courier Cargo Bay (The mysterious package glowing in trunk)
  ctx.fillStyle = '#f59e0b';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = vehicle.speed > 50 ? 8 : 4;
  ctx.fillRect(-6, carH / 2 - 16, 12, 10);
  ctx.shadowBlur = 0; // Reset shadow

  // Taillights / Brake Lights
  ctx.fillStyle = vehicle.isBraking ? '#ff0033' : '#7f1d1d';
  if (vehicle.isBraking) {
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 12;
  }
  ctx.fillRect(-carW / 2 + 2, carH / 2 - 3, 7, 3);
  ctx.fillRect(carW / 2 - 9, carH / 2 - 3, 7, 3);
  ctx.shadowBlur = 0;

  ctx.restore();
}
