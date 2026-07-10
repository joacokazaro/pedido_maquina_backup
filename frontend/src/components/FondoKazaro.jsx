const BEAMS = [
	{ top: "14%", width: 380, thickness: 2, duration: 11, delay: 0, core: "rgba(17, 114, 193, 0.45)", glow: "rgba(74, 164, 224, 0.3)", opacity: 0.55 },
	{ top: "38%", width: 260, thickness: 2, duration: 13, delay: 4.5, core: "rgba(43, 175, 198, 0.4)", glow: "rgba(43, 175, 198, 0.25)", opacity: 0.5 },
	{ top: "60%", width: 420, thickness: 2, duration: 12, delay: 8, core: "rgba(17, 114, 193, 0.4)", glow: "rgba(74, 164, 224, 0.25)", opacity: 0.5 },
	{ top: "82%", width: 300, thickness: 2, duration: 14, delay: 2.5, core: "rgba(101, 188, 123, 0.35)", glow: "rgba(101, 188, 123, 0.2)", opacity: 0.45 },
];

/**
 * Fondo dinámico de marca (versión clara): gradiente, auroras y
 * rayos sutiles. Capa fija que no intercepta clics ni scroll.
 */
export default function FondoKazaro({ className = "-z-10" }) {
	return (
		<div className={`pointer-events-none fixed inset-0 ${className}`} aria-hidden="true">
			<div className="absolute inset-0 bg-gradient-to-br from-[#f4f9fd] via-[#edf5fb] to-[#e4f0f6]" />

			<div className="kz-blob-a absolute -left-44 -top-44 h-[540px] w-[540px] rounded-full bg-[#4aa4e0]/20 blur-3xl" />
			<div className="kz-blob-b absolute -right-52 top-1/3 h-[580px] w-[580px] rounded-full bg-[#2bafc6]/15 blur-3xl" />
			<div className="kz-blob-c absolute -bottom-56 left-1/3 h-[540px] w-[540px] rounded-full bg-[#65bc7b]/15 blur-3xl" />

			<div className="absolute inset-[-25%] -rotate-[24deg]">
				{BEAMS.map((beam, i) => (
					<span
						key={i}
						className="kz-beam"
						style={{
							top: beam.top,
							left: 0,
							width: `${beam.width}px`,
							height: `${beam.thickness}px`,
							background: `linear-gradient(90deg, transparent, ${beam.core}, transparent)`,
							boxShadow: `0 0 12px 1px ${beam.glow}`,
							animationDuration: `${beam.duration}s`,
							animationDelay: `${beam.delay}s`,
							"--kz-beam-opacity": beam.opacity,
						}}
					/>
				))}
			</div>
		</div>
	);
}
