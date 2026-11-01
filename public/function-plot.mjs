import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { evaluate } from './formula-catalog.mjs';

let plotSequence = 0;

// D3 handles coordinate scales and the SVG line path; lesson data remains an
// allowlisted fixed formula. Build detached so invalid input preserves the old plot.
export function drawGraph(container, graph, language, inputX = 0) {
  const [width, height, left, right, top, bottom] = [640, 420, 55, 610, 25, 365];
  const range = graph?.range ?? [-1, 1]; // vertical window from the checked limits
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1] || !Number.isFinite(range[1] - range[0])) {
    throw new Error('Graph range must contain two increasing finite values.');
  }
  if (typeof inputX !== 'number' || !Number.isFinite(inputX)) throw new Error('Graph input must be finite.');
  if (graph && (!Array.isArray(graph.crossings) || !graph.crossings.every(Number.isFinite) || !Array.isArray(graph.asymptotes) || !graph.asymptotes.every(Number.isFinite))) {
    throw new Error('Graph markers must be finite numbers.');
  }
  const xScale = scaleLinear().domain([-8, 8]).range([left, right]);
  const yScale = scaleLinear().domain(range).range([bottom, top]);
  if (!Number.isFinite(xScale(inputX))) throw new Error('Graph input is outside the finite coordinate range.');
  const svg = select(container.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    .attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
    .attr('aria-label', graph ? `${graph.expression}; x → −∞: y → ${graph.leftLimit}; x → ∞: y → ${graph.rightLimit}; ${language === 'zh' ? '交点的 x 值' : 'crossing x-values'}: ${graph.crossings.join(', ') || (language === 'zh' ? '无' : 'none')}` : (language === 'zh' ? '图像将在反思后显示' : 'Graph waiting for your reasoning'));
  const clipId = `function-plot-clip-${++plotSequence}`;
  svg.append('defs').append('clipPath').attr('id', clipId).append('rect')
    .attr('x', left).attr('y', top).attr('width', right-left).attr('height', bottom-top);
  const clip = `url(#${clipId})`;
  for (const x of [-8, -6, -4, -2, 0, 2, 4, 6, 8]) {
    svg.append('line').attr('x1', xScale(x)).attr('y1', top).attr('x2', xScale(x)).attr('y2', bottom).attr('stroke', 'var(--theme-border, #dce1d5)');
    svg.append('text').attr('x', xScale(x)).attr('y', bottom+24).attr('text-anchor', 'middle').attr('fill', 'var(--theme-muted, #68776c)').attr('font-size', 13).text(x);
  }
  for (let tick = 0; tick <= 4; tick++) {
    const y = range[0] + tick / 4 * (range[1] - range[0]);
    svg.append('line').attr('x1', left).attr('y1', yScale(y)).attr('x2', right).attr('y2', yScale(y)).attr('stroke', 'var(--theme-border, #dce1d5)');
    svg.append('text').attr('x', left-10).attr('y', yScale(y)+4).attr('text-anchor', 'end').attr('fill', 'var(--theme-muted, #68776c)').attr('font-size', 12).text(Number(y.toFixed(2)));
  }
  svg.append('line').attr('x1', xScale(0)).attr('y1', top).attr('x2', xScale(0)).attr('y2', bottom).attr('stroke', 'var(--theme-edge, #98a793)');
  if (range[0] <= 0 && range[1] >= 0) svg.append('line').attr('x1', left).attr('y1', yScale(0)).attr('x2', right).attr('y2', yScale(0)).attr('stroke', 'var(--theme-edge, #98a793)');
  svg.append('text').attr('x', right).attr('y', bottom+44).attr('fill', 'var(--theme-muted, #68776c)').attr('font-size', 14).text('x');
  if (graph) {
    for (const asymptote of graph.asymptotes) {
      svg.append('line').attr('x1', left).attr('y1', yScale(asymptote)).attr('x2', right).attr('y2', yScale(asymptote)).attr('stroke', 'var(--theme-edge, #87986a)').attr('stroke-width', 2).attr('stroke-dasharray', '8 7');
      svg.append('text').attr('x', right-5).attr('y', yScale(asymptote)-8).attr('text-anchor', 'end').attr('fill', 'var(--theme-muted, #5b7243)').attr('font-size', 13).text(`y = ${asymptote}`);
    }
    const samples = Array.from({length: 641}, (_, i) => {
      const x = -8 + i / 40;
      return {x, y: evaluate(graph.formula, x)};
    });
    const path = line().x(point => xScale(point.x)).y(point => yScale(point.y)).digits(2);
    svg.append('path').attr('d', path(samples)).attr('fill', 'none').attr('stroke', 'var(--series-0, #116d60)').attr('stroke-width', 3.5).attr('stroke-linecap', 'round').attr('clip-path', clip);
    for (const x of graph.crossings) svg.append('circle').attr('cx', xScale(x)).attr('cy', yScale(evaluate(graph.formula, x))).attr('r', 6).attr('fill', 'var(--series-0, #116d60)').attr('stroke', '#f6f5ef').attr('stroke-width', 2);
    svg.append('circle').attr('cx', xScale(inputX)).attr('cy', yScale(evaluate(graph.formula, inputX))).attr('r', 5).attr('fill', 'var(--theme-ink, #20332f)').attr('clip-path', clip);
  } else {
    svg.append('text').attr('x', 330).attr('y', 185).attr('text-anchor', 'middle').attr('fill', 'var(--theme-muted, #82917b)').attr('font-size', 21).attr('font-family', 'Georgia, serif').text(language === 'zh' ? '先讲出你的想法。' : 'Your explanation comes first.');
  }
  container.replaceChildren(svg.node());
}
