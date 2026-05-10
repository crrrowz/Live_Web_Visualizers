// waveform.js — 2D canvas audio waveform drawing

export function drawWaveform(ctx, W, H, analyser, waveformArray, dataArray, smoothBass) {
    analyser.getByteTimeDomainData(waveformArray);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const baseRadius = Math.min(W, H) * 0.22;
    const sliceCount = waveformArray.length;

    // --- Circular waveform rings ---
    for (let ring = 0; ring < 3; ring++) {
        const alpha = [0.6, 0.3, 0.15][ring];
        const rOffset = ring * 15;
        const colors = [
            `rgba(139, 92, 246, ${alpha})`,
            `rgba(0, 240, 255, ${alpha})`,
            `rgba(255, 0, 110, ${alpha})`
        ];

        ctx.beginPath();
        ctx.strokeStyle = colors[ring];
        ctx.lineWidth = 2 - ring * 0.5;
        ctx.shadowColor = colors[ring];
        ctx.shadowBlur = 15;

        for (let i = 0; i <= sliceCount; i++) {
            const v = (waveformArray[i % sliceCount] - 128) / 128.0;
            const angle = (i / sliceCount) * Math.PI * 2 - Math.PI / 2;
            const r = baseRadius + rOffset + v * (40 + smoothBass * 80);
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // --- Horizontal wave ---
    const waveY = H * 0.75;
    ctx.beginPath();
    const grad = ctx.createLinearGradient(0, waveY - 30, W, waveY + 30);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)');
    grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.5)');
    grad.addColorStop(1, 'rgba(255, 0, 110, 0.5)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 10;

    const step = W / sliceCount;
    for (let i = 0; i < sliceCount; i++) {
        const v = (waveformArray[i] - 128) / 128.0;
        const x = i * step;
        const y = waveY + v * (30 + smoothBass * 60);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- Frequency bars around center ---
    analyser.getByteFrequencyData(dataArray);
    const barCount = 64;
    const barWidth = 3;
    for (let i = 0; i < barCount; i++) {
        const val = dataArray[i] / 255;
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const innerR = baseRadius - 20;
        const barLen = val * (50 + smoothBass * 40);
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * (innerR - barLen);
        const y2 = cy + Math.sin(angle) * (innerR - barLen);

        const hue = 260 + (i / barCount) * 120;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.4 + val * 0.6})`;
        ctx.lineWidth = barWidth;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}
