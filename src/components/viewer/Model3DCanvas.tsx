import React, { useEffect, useRef, useState } from 'react';
import { Box, RotateCcw, Upload } from 'lucide-react';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const DEFAULT_VERTICES: Vec3[] = [
  { x: 0, y: 1.35, z: 0 },
  { x: 1.15, y: 0.35, z: 0 },
  { x: 0.35, y: 0.35, z: 1.1 },
  { x: -0.95, y: 0.35, z: 0.68 },
  { x: -0.95, y: 0.35, z: -0.68 },
  { x: 0.35, y: 0.35, z: -1.1 },
  { x: 0.95, y: -0.45, z: 0.68 },
  { x: -0.35, y: -0.45, z: 1.1 },
  { x: -1.15, y: -0.45, z: 0 },
  { x: -0.35, y: -0.45, z: -1.1 },
  { x: 0.95, y: -0.45, z: -0.68 },
  { x: 0, y: -1.35, z: 0 },
];

const DEFAULT_FACES: number[][] = [
  [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 1],
  [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 8], [3, 8, 4],
  [4, 8, 9], [4, 9, 5], [5, 9, 10], [5, 10, 1], [1, 10, 6],
  [11, 7, 6], [11, 8, 7], [11, 9, 8], [11, 10, 9], [11, 6, 10],
];

export default function Model3DCanvas({ title }: { title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [autoSpin, setAutoSpin] = useState(true);
  const [rot, setRot] = useState({ x: 0.35, y: 0.6 });
  const [zoom, setZoom] = useState(145);
  const [mesh, setMesh] = useState<{ vertices: Vec3[]; faces: number[][] }>({
    vertices: DEFAULT_VERTICES,
    faces: DEFAULT_FACES,
  });
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let raf = 0;
    const render = () => {
      if (autoSpin && !draggingRef.current) {
        setRot((r) => ({ ...r, y: r.y + 0.008 }));
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Forensic measurement grid
      ctx.strokeStyle = 'rgba(198, 156, 75, 0.16)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const cosY = Math.cos(rot.y);
      const sinY = Math.sin(rot.y);
      const cosX = Math.cos(rot.x);
      const sinX = Math.sin(rot.x);

      const transformed = mesh.vertices.map((v) => {
        const x1 = v.x * cosY - v.z * sinY;
        const z1 = v.x * sinY + v.z * cosY;
        const y2 = v.y * cosX - z1 * sinX;
        const z2 = v.y * sinX + z1 * cosX;
        const perspective = 4.2 / (4.2 + z2);
        return {
          x: w / 2 + x1 * zoom * perspective,
          y: h / 2 - y2 * zoom * perspective,
          z: z2,
          raw: { x: x1, y: y2, z: z2 },
        };
      });

      const projectedFaces = mesh.faces
        .map((face) => {
          const pts = face.map((idx) => transformed[idx]).filter(Boolean);
          if (pts.length < 3) return null;
          const avgZ = pts.reduce((acc, p) => acc + p.z, 0) / pts.length;
          const a = pts[0].raw;
          const b = pts[1].raw;
          const c = pts[2].raw;
          const ux = b.x - a.x;
          const uy = b.y - a.y;
          const uz = b.z - a.z;
          const vx = c.x - a.x;
          const vy = c.y - a.y;
          const vz = c.z - a.z;
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const len = Math.hypot(nx, ny, nz) || 1;
          const light = Math.max(0.25, (nx * 0.4 + ny * 0.6 - nz * 0.7) / len);
          return { pts, avgZ, light };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .sort((a, b) => b.avgZ - a.avgZ);

      for (const f of projectedFaces) {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) {
          ctx.lineTo(f.pts[i].x, f.pts[i].y);
        }
        ctx.closePath();

        if (!wireframe) {
          const shade = Math.round(90 + f.light * 135);
          ctx.fillStyle = `rgba(${shade}, ${Math.round(shade * 0.78)}, ${Math.round(shade * 0.48)}, 0.9)`;
          ctx.fill();
        }
        ctx.strokeStyle = wireframe ? '#9E1B16' : 'rgba(235, 218, 185, 0.45)';
        ctx.lineWidth = wireframe ? 1.4 : 0.9;
        ctx.stroke();
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [rot, zoom, wireframe, autoSpin, mesh]);

  const handleLoadObjFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const verts: Vec3[] = [];
    const faces: number[][] = [];

    for (const line of text.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'v' && parts.length >= 4) {
        verts.push({
          x: parseFloat(parts[1]) || 0,
          y: parseFloat(parts[2]) || 0,
          z: parseFloat(parts[3]) || 0,
        });
      } else if (parts[0] === 'f' && parts.length >= 4) {
        const idxList = parts
          .slice(1)
          .map((token) => parseInt(token.split('/')[0], 10) - 1)
          .filter((n) => !Number.isNaN(n) && n >= 0);
        if (idxList.length >= 3) faces.push(idxList);
      }
    }

    if (verts.length > 0 && faces.length > 0) {
      const maxAbs = Math.max(
        1,
        ...verts.flatMap((v) => [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)])
      );
      setMesh({
        vertices: verts.map((v) => ({
          x: (v.x / maxAbs) * 1.4,
          y: (v.y / maxAbs) * 1.4,
          z: (v.z / maxAbs) * 1.4,
        })),
        faces: faces.slice(0, 1200),
      });
    }
  };

  return (
    <div className="border-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#1A130D] overflow-hidden hard-shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#2A2018] dark:bg-[#3A0C0C] border-b-2 border-[#14100C] text-[#EBDAB9]">
        <div className="flex items-center gap-2 text-xs font-typewriter">
          <Box className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
          <span>{title}</span>
          <span className="font-mono-tabular text-[#C69C4B]">
            · {mesh.vertices.length} đỉnh · {mesh.faces.length} mặt
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWireframe((w) => !w)}
            className={`px-2.5 py-1 text-xs font-typewriter uppercase border ${
              wireframe ? 'bg-[#9E1B16] border-[#F5EAD2] text-white' : 'bg-[#14100C] border-[#6E5332] text-[#EBDAB9]'
            }`}
          >
            {wireframe ? 'Khung dây' : 'Đổ bóng 3D'}
          </button>
          <button
            onClick={() => setAutoSpin((s) => !s)}
            className="px-2.5 py-1 text-xs font-typewriter uppercase bg-[#14100C] border border-[#6E5332] text-[#EBDAB9] hover:bg-[#3A2E23]"
          >
            {autoSpin ? 'Dừng xoay' : 'Tự xoay'}
          </button>
          <button
            onClick={() => {
              setRot({ x: 0.35, y: 0.6 });
              setZoom(145);
            }}
            className="p-1.5 bg-[#14100C] border border-[#6E5332] text-[#EBDAB9] hover:bg-[#3A2E23]"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <label className="flex items-center gap-1 px-2.5 py-1 text-xs font-typewriter uppercase bg-[#9E1B16] text-[#F5EAD2] hover:bg-[#C81E1E] cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Nạp .OBJ
            <input type="file" accept=".obj" onChange={handleLoadObjFile} className="hidden" />
          </label>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={820}
        height={420}
        onMouseDown={(e) => {
          draggingRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseMove={(e) => {
          if (!draggingRef.current) return;
          const dx = e.clientX - lastMouseRef.current.x;
          const dy = e.clientY - lastMouseRef.current.y;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          setRot((r) => ({ x: r.x + dy * 0.01, y: r.y + dx * 0.01 }));
        }}
        onMouseUp={() => {
          draggingRef.current = false;
        }}
        onMouseLeave={() => {
          draggingRef.current = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => Math.min(280, Math.max(70, z - e.deltaY * 0.15)));
        }}
        className="w-full h-[380px] cursor-grab active:cursor-grabbing block"
      />
    </div>
  );
}
