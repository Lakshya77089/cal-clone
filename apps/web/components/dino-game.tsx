"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "over";

const W = 600;
const H = 150;
const GROUND_Y = 125;
const GRAVITY = 0.6;
const JUMP_V = -10.5;
const BASE_SPEED = 6;
const DINO_X = 25;
const DINO_W = 44;
const DINO_H = 47;

type Cactus = { x: number; w: number; h: number; type: "small" | "large" };
type Cloud = { x: number; y: number };

export function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const stateRef = useRef({
    dinoY: GROUND_Y,
    dinoV: 0,
    obstacles: [] as Cactus[],
    clouds: [] as Cloud[],
    groundOffset: 0,
    speed: BASE_SPEED,
    frame: 0,
    nextSpawn: 60,
    nextCloud: 80,
    phase: "idle" as Phase,
    score: 0,
    legFrame: 0,
  });

  useEffect(() => {
    const saved = Number(localStorage.getItem("dino-best") || "0");
    setBest(saved);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const reset = () => {
      stateRef.current = {
        dinoY: GROUND_Y,
        dinoV: 0,
        obstacles: [],
        clouds: [{ x: 380, y: 30 }, { x: 520, y: 50 }],
        groundOffset: 0,
        speed: BASE_SPEED,
        frame: 0,
        nextSpawn: 50,
        nextCloud: 120,
        phase: "running",
        score: 0,
        legFrame: 0,
      };
      setScore(0);
      setPhase("running");
    };

    const jump = () => {
      const s = stateRef.current;
      if (s.phase === "running" && s.dinoY >= GROUND_Y) {
        s.dinoV = JUMP_V;
      } else if (s.phase !== "running") {
        reset();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    const onClick = () => jump();

    window.addEventListener("keydown", onKey);
    canvasRef.current?.addEventListener("pointerdown", onClick);

    // === Drawing helpers ===

    // Dino sprite drawn from rectangles in classic blocky style.
    // Origin: top-left of the bounding box.
    const drawDino = (x: number, y: number, leg: 0 | 1) => {
      ctx.fillStyle = "#535353";
      // Head
      ctx.fillRect(x + 22, y + 0, 22, 22);
      // Eye (white)
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 36, y + 6, 4, 4);
      ctx.fillStyle = "#535353";
      ctx.fillRect(x + 38, y + 7, 2, 2);
      // Neck / upper body
      ctx.fillRect(x + 18, y + 14, 4, 12);
      ctx.fillRect(x + 14, y + 18, 4, 8);
      // Mouth notch (cut out)
      ctx.clearRect(x + 40, y + 14, 4, 4);
      // Body
      ctx.fillRect(x + 4, y + 22, 22, 18);
      // Tail
      ctx.fillRect(x + 0, y + 18, 6, 6);
      // Arm
      ctx.fillRect(x + 22, y + 28, 6, 3);

      // Legs — alternating
      if (leg === 0) {
        ctx.fillRect(x + 6, y + 40, 6, 7); // back leg down
        ctx.fillRect(x + 18, y + 40, 6, 4); // front leg up
      } else {
        ctx.fillRect(x + 6, y + 40, 6, 4); // back leg up
        ctx.fillRect(x + 18, y + 40, 6, 7); // front leg down
      }
      // Foot detail
      ctx.fillRect(x + 6, y + 45, 8, 2);
      ctx.fillRect(x + 18, y + 45, 8, 2);
    };

    const drawDinoIdle = (x: number, y: number) => {
      // Both legs down when idle
      ctx.fillStyle = "#535353";
      ctx.fillRect(x + 22, y + 0, 22, 22);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 36, y + 6, 4, 4);
      ctx.fillStyle = "#535353";
      ctx.fillRect(x + 38, y + 7, 2, 2);
      ctx.fillRect(x + 18, y + 14, 4, 12);
      ctx.fillRect(x + 14, y + 18, 4, 8);
      ctx.clearRect(x + 40, y + 14, 4, 4);
      ctx.fillRect(x + 4, y + 22, 22, 18);
      ctx.fillRect(x + 0, y + 18, 6, 6);
      ctx.fillRect(x + 22, y + 28, 6, 3);
      ctx.fillRect(x + 6, y + 40, 6, 7);
      ctx.fillRect(x + 18, y + 40, 6, 7);
      ctx.fillRect(x + 6, y + 45, 8, 2);
      ctx.fillRect(x + 18, y + 45, 8, 2);
    };

    const drawCactus = (c: Cactus) => {
      ctx.fillStyle = "#535353";
      const baseX = c.x;
      const baseY = GROUND_Y - c.h + DINO_H;
      if (c.type === "small") {
        // Single small cactus: trunk + two arms
        ctx.fillRect(baseX + 4, baseY, 6, c.h);
        ctx.fillRect(baseX + 0, baseY + 6, 4, 8); // left arm
        ctx.fillRect(baseX + 10, baseY + 4, 4, 10); // right arm
      } else {
        // Large cactus
        ctx.fillRect(baseX + 6, baseY, 10, c.h);
        ctx.fillRect(baseX + 0, baseY + 8, 6, 14);
        ctx.fillRect(baseX + 16, baseY + 6, 6, 16);
      }
    };

    const drawCloud = (cl: Cloud) => {
      ctx.fillStyle = "#c8c8c8";
      // pixel cloud
      ctx.fillRect(cl.x + 4, cl.y + 0, 14, 4);
      ctx.fillRect(cl.x + 0, cl.y + 4, 22, 4);
      ctx.fillRect(cl.x + 4, cl.y + 8, 14, 4);
    };

    const drawGround = (offset: number) => {
      const y = GROUND_Y + DINO_H;
      ctx.fillStyle = "#535353";
      ctx.fillRect(0, y, W, 1);
      // Dashes / pebbles
      ctx.fillStyle = "#535353";
      const off = Math.floor(offset) % 40;
      for (let x = -off; x < W; x += 40) {
        ctx.fillRect(x + 8, y + 4, 3, 1);
        ctx.fillRect(x + 22, y + 6, 5, 1);
        ctx.fillRect(x + 32, y + 3, 2, 1);
      }
    };

    const drawHud = (current: number, hi: number, blink: boolean) => {
      ctx.fillStyle = "#535353";
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.textAlign = "right";
      const cur = String(current).padStart(5, "0");
      const hiStr = String(hi).padStart(5, "0");
      // HI on the left of score
      if (!blink) ctx.fillText(`HI ${hiStr}`, W - 70, 22);
      ctx.fillText(cur, W - 10, 22);
    };

    // === Loop ===

    const step = () => {
      const s = stateRef.current;
      s.frame++;

      // Clear with chrome's near-white
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(0, 0, W, H);

      // Ground
      if (s.phase !== "idle") {
        s.groundOffset += s.speed;
      }
      drawGround(s.groundOffset);

      // Clouds drift slowly
      if (s.phase === "running") {
        s.nextCloud--;
        if (s.nextCloud <= 0) {
          s.clouds.push({ x: W + 10, y: 20 + Math.random() * 40 });
          s.nextCloud = 200 + Math.floor(Math.random() * 200);
        }
        for (const c of s.clouds) c.x -= s.speed * 0.3;
        s.clouds = s.clouds.filter((c) => c.x + 22 > 0);
      }
      for (const c of s.clouds) drawCloud(c);

      // Dino physics
      if (s.phase === "running") {
        s.dinoV += GRAVITY;
        s.dinoY += s.dinoV;
        if (s.dinoY > GROUND_Y) {
          s.dinoY = GROUND_Y;
          s.dinoV = 0;
        }
        s.score += 0.1;
        s.speed = BASE_SPEED + s.score / 150;

        // Leg animation: switch every 6 frames while grounded
        if (s.dinoY >= GROUND_Y && s.frame % 6 === 0) {
          s.legFrame = s.legFrame === 0 ? 1 : 0;
        }

        // Obstacles
        s.nextSpawn--;
        if (s.nextSpawn <= 0) {
          const isLarge = Math.random() > 0.5;
          const h = isLarge ? 30 + Math.floor(Math.random() * 14) : 22 + Math.floor(Math.random() * 8);
          const w = isLarge ? 22 : 14;
          s.obstacles.push({ x: W, w, h, type: isLarge ? "large" : "small" });
          // gap shrinks with score
          const baseGap = 60 - s.score / 30;
          s.nextSpawn = Math.max(35, Math.floor(baseGap + Math.random() * 60));
        }
        for (const o of s.obstacles) o.x -= s.speed;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > 0);

        // Collision — slightly inset hitbox for forgiveness
        const dinoLeft = DINO_X + 6;
        const dinoRight = DINO_X + DINO_W - 4;
        const dinoTop = s.dinoY + 6;
        const dinoBottom = s.dinoY + DINO_H - 2;
        for (const o of s.obstacles) {
          const ox = o.x + 2;
          const ox2 = o.x + o.w - 2;
          const oy = GROUND_Y + DINO_H - o.h;
          const oy2 = GROUND_Y + DINO_H;
          if (dinoRight > ox && dinoLeft < ox2 && dinoBottom > oy && dinoTop < oy2) {
            s.phase = "over";
            setPhase("over");
            const final = Math.floor(s.score);
            setScore(final);
            setBest((prev) => {
              const next = Math.max(prev, final);
              localStorage.setItem("dino-best", String(next));
              return next;
            });
            break;
          }
        }

        setScore(Math.floor(s.score));
      }

      // Draw obstacles
      for (const o of s.obstacles) drawCactus(o);

      // Draw dino
      if (s.phase === "idle") {
        drawDinoIdle(DINO_X, s.dinoY);
      } else if (s.phase === "running") {
        if (s.dinoY < GROUND_Y) {
          // Jumping — both legs together
          drawDinoIdle(DINO_X, s.dinoY);
        } else {
          drawDino(DINO_X, s.dinoY, s.legFrame as 0 | 1);
        }
      } else {
        // Game over — sad dino (eye closed = small line)
        drawDinoIdle(DINO_X, s.dinoY);
        ctx.fillStyle = "#f7f7f7";
        ctx.fillRect(DINO_X + 36, s.dinoY + 6, 4, 4);
        ctx.fillStyle = "#535353";
        ctx.fillRect(DINO_X + 36, s.dinoY + 8, 4, 2);
      }

      // HUD — score blinks every 100 points to celebrate
      const blink = s.phase === "running" && Math.floor(s.score) > 0 && Math.floor(s.score) % 100 < 4 && s.frame % 8 < 4;
      drawHud(Math.floor(s.score), best, blink);

      // Game over banner
      if (s.phase === "over") {
        ctx.fillStyle = "#535353";
        ctx.font = "bold 18px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("G A M E   O V E R", W / 2, 50);
        // Refresh icon (pixel)
        const rx = W / 2 - 8;
        const ry = 65;
        ctx.fillRect(rx, ry, 16, 2);
        ctx.fillRect(rx, ry, 2, 8);
        ctx.fillRect(rx, ry + 6, 8, 2);
        ctx.fillRect(rx + 14, ry, 2, 14);
        ctx.fillRect(rx + 6, ry + 12, 10, 2);
        // arrow head
        ctx.fillRect(rx + 12, ry + 10, 2, 2);
        ctx.fillRect(rx + 16, ry + 10, 2, 2);
      }

      if (s.phase === "idle") {
        ctx.fillStyle = "#535353";
        ctx.font = "12px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("Press SPACE to start", W / 2, 60);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [best]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full max-w-[600px] cursor-pointer rounded-md border border-border bg-[#f7f7f7]"
        style={{ imageRendering: "pixelated" }}
      />
      <p className="text-xs text-muted-foreground">
        Space / ↑ / tap to jump · {score} · HI {best}
      </p>
    </div>
  );
}
