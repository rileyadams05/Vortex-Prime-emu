import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

const VortexBackground = ({ src }) => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    if (src) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let rot = 0;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2;
      const maxR = Math.hypot(w, h) * 0.54;

      // Dark base matching the icon background
      ctx.fillStyle = "#020d08";
      ctx.fillRect(0, 0, w, h);

      const numRings = 90;
      const numArms  = 3;
      const turns    = 2.8; // spiral rotations from centre to edge

      for (let i = 2; i <= numRings; i++) {
        const t    = i / numRings;
        const r    = t * maxR;
        const ringW = (maxR / numRings) * 1.5;

        // Brightness: peaks mid-radius, dark at centre and edge
        const env = Math.pow(Math.sin(t * Math.PI), 0.65);
        if (env < 0.02) continue;

        for (let arm = 0; arm < numArms; arm++) {
          // Spiral: angle offset grows with radius → arms spiral inward
          const baseAngle = rot + (arm / numArms) * TAU + t * turns * TAU;
          const arcSpan   = (TAU / numArms) * 0.62;

          // Alternate neon green and teal-cyan, matching the icon palette
          const hue  = arm % 2 === 0 ? 145 : 172;
          const lit  = 42 + env * 18;
          const alph = env * 0.92;

          ctx.shadowBlur  = 22 * env;
          ctx.shadowColor = arm % 2 === 0
            ? "rgba(0,255,120," + (env * 0.75) + ")"
            : "rgba(0,225,255," + (env * 0.75) + ")";

          // Filled donut arc segment
          ctx.beginPath();
          ctx.arc(cx, cy, r,                      baseAngle,            baseAngle + arcSpan, false);
          ctx.arc(cx, cy, Math.max(1, r - ringW), baseAngle + arcSpan,  baseAngle,           true);
          ctx.closePath();
          ctx.fillStyle = "hsla(" + hue + ",100%," + lit + "%," + alph + ")";
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;

      // Dark centre vignette so dashboard UI stays readable
      const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.72);
      vig.addColorStop(0,    "rgba(0,0,0,0.80)");
      vig.addColorStop(0.25, "rgba(0,0,0,0.55)");
      vig.addColorStop(0.55, "rgba(0,0,0,0.20)");
      vig.addColorStop(1,    "rgba(0,0,0,0.04)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      rot += 0.006; // constant clockwise spin
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [src]);

  if (src) {
    return (
      <div
        className="xenia-background"
        style={{ backgroundImage: "url(" + src + ")" }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", top: 0, left: 0,
        width: "100%", height: "100%",
        zIndex: 0,
      }}
    />
  );
};

export default VortexBackground;
