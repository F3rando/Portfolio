import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const GITHUB_REPO = 'F3rando/Portfolio';

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 600;
const CHART_MARGIN = { top: 10, right: 10, bottom: 30, left: 20 };

let allData;
let allCommits;
let filteredCommits;
let visibleCommits;

let commitProgress = 100;
let commitMaxTime;
let timeScale;

let chartXScale;
let chartYScale;
let chartRScale;
let chartUsableArea;

const fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `https://github.com/${GITHUB_REPO}/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: true,
      });

      return ret;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('Distinct files');
  dl.append('dd').text(d3.group(data, (d) => d.file).size);

  dl.append('dt').text('Max nesting depth');
  dl.append('dd').text(d3.max(data, (d) => d.depth) ?? 0);

  const avgLen = d3.mean(data, (d) => d.length);
  dl.append('dt').text('Avg line length');
  dl.append('dd').text(avgLen != null ? avgLen.toFixed(1) + ' chars' : '—');

  const byWeekday = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en-US', { weekday: 'long' }),
  );
  const busiestDay = d3.greatest(byWeekday, (d) => d[1])?.[0];
  dl.append('dt').text('Busiest weekday');
  dl.append('dd').text(busiestDay ?? '—');
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const timeEl = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  timeEl.textContent =
    commit.datetime?.toLocaleTimeString('en', {
      timeStyle: 'short',
    }) ?? '';
  author.textContent = commit.author ?? '';
  lines.textContent = String(commit.totalLines ?? '');
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  const pad = 12;
  tooltip.style.left = `${event.clientX + pad}px`;
  tooltip.style.top = `${event.clientY + pad}px`;
}

function bindDotInteractions(selection) {
  selection
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

function updateFileDisplay(commits) {
  const lines = commits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append('div').call((div) => {
          const title = div.append('dt');
          title.append('code');
          title.append('small');
          div.append('dd');
        }),
      (update) => update,
      (exit) => exit.remove(),
    );

  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer
    .select('dt > small')
    .text((d) => `${d.lines.length} lines`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines, (d) => `${d.file}:${d.line}:${d.commit}`)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${fileTypeColors(d.type)}`);
}

function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  visibleCommits = commits;

  chartXScale.domain(d3.extent(commits, (d) => d.datetime)).nice();

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  if (minLines != null && maxLines != null) {
    chartRScale.domain([minLines, maxLines]);
  }

  const xAxis = d3.axisBottom(chartXScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  const dots = svg.select('g.dots');

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => chartXScale(d.datetime))
    .attr('cy', (d) => chartYScale(d.hourFrac))
    .attr('r', (d) => chartRScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .attr('stroke', 'transparent')
    .attr('stroke-width', 14)
    .attr('pointer-events', 'all')
    .call(bindDotInteractions);
}

function renderCommitStory(commits) {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits, (d) => d.id)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
        <p>
          On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}, I made
          <a href="${d.url}" target="_blank" rel="noopener noreferrer">
            ${i > 0 ? 'another commit' : 'my first commit'}
          </a>.
        </p>
        <p>
          This commit edited ${d.totalLines} lines across
          ${
            d3.rollups(
              d.lines,
              (lines) => lines.length,
              (line) => line.file,
            ).length
          }
          files.
        </p>
      `,
    );
}

function updateToCommitTime(datetime) {
  const slider = document.getElementById('commit-progress');
  const cutoffTime = document.getElementById('commit-cutoff-time');

  commitMaxTime = datetime;
  commitProgress = timeScale(commitMaxTime);

  if (slider) {
    slider.value = commitProgress;
  }

  if (cutoffTime) {
    cutoffTime.textContent = commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  }

  filteredCommits = allCommits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(allData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function onStepEnter(response) {
  const commit = response.element.__data__;
  if (!commit) return;

  d3.selectAll('#scatter-story .step').classed(
    'active',
    (d) => d.id === commit.id,
  );
  updateToCommitTime(commit.datetime);
}

function setupScrollytelling() {
  const scroller = scrollama();
  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
      offset: 0.5,
    })
    .onStepEnter(onStepEnter);

  window.addEventListener('resize', scroller.resize);
}

function renderScatterPlot(data, commits) {
  d3.select('#chart').selectAll('*').remove();

  chartUsableArea = {
    top: CHART_MARGIN.top,
    right: CHART_WIDTH - CHART_MARGIN.right,
    bottom: CHART_HEIGHT - CHART_MARGIN.bottom,
    left: CHART_MARGIN.left,
    width: CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right,
    height: CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)
    .style('overflow', 'visible');

  chartXScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([chartUsableArea.left, chartUsableArea.right])
    .nice();

  chartYScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([chartUsableArea.bottom, chartUsableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  chartRScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  visibleCommits = commits;

  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${chartUsableArea.left}, 0)`);

  gridlines.call(
    d3
      .axisLeft(chartYScale)
      .tickFormat(() => '')
      .tickSize(-chartUsableArea.width),
  );

  const xAxis = d3.axisBottom(chartXScale);
  const yAxis = d3
    .axisLeft(chartYScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${chartUsableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${chartUsableArea.left}, 0)`)
    .call(yAxis);

  const dots = svg.append('g').attr('class', 'dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => chartXScale(d.datetime))
    .attr('cy', (d) => chartYScale(d.hourFrac))
    .attr('r', (d) => chartRScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .attr('stroke', 'transparent')
    .attr('stroke-width', 14)
    .attr('pointer-events', 'all')
    .call(bindDotInteractions);

  function isCommitSelected(selection, commit) {
    if (!selection) {
      return false;
    }
    const [[x0, y0], [x1, y1]] = selection;
    const x = chartXScale(commit.datetime);
    const y = chartYScale(commit.hourFrac);
    const xMin = Math.min(x0, x1);
    const xMax = Math.max(x0, x1);
    const yMin = Math.min(y0, y1);
    const yMax = Math.max(y0, y1);
    return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
  }

  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? visibleCommits.filter((d) => isCommitSelected(selection, d))
      : [];

    const countElement = document.querySelector('#selection-count');
    if (countElement) {
      countElement.textContent = `${
        selectedCommits.length || 'No'
      } commits selected`;
    }

    return selectedCommits;
  }

  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? visibleCommits.filter((d) => isCommitSelected(selection, d))
      : [];
    const container = document.getElementById('language-breakdown');

    if (!container) return;

    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }

    const lines = selectedCommits.flatMap((d) => d.lines);

    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type,
    );

    container.innerHTML = '';

    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);

      container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
    }
  }

  function brushed(event) {
    const selection = event.selection;
    svg
      .selectAll('.dots circle')
      .classed('selected', (d) => isCommitSelected(selection, d));
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  svg.call(d3.brush().on('start brush end', brushed));

  svg.selectAll('.dots, .overlay ~ *').raise();

  renderSelectionCount(null);
  renderLanguageBreakdown(null);
}

function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');

  commitProgress = Number(slider.value);
  updateToCommitTime(timeScale.invert(commitProgress));
}

allData = await loadData();
allCommits = processCommits(allData);
filteredCommits = allCommits;

timeScale = d3
  .scaleTime()
  .domain([
    d3.min(allCommits, (d) => d.datetime),
    d3.max(allCommits, (d) => d.datetime),
  ])
  .range([0, 100]);

renderCommitInfo(allData, allCommits);
renderScatterPlot(allData, filteredCommits);
renderCommitStory(allCommits);
setupScrollytelling();

const commitSlider = document.getElementById('commit-progress');
if (commitSlider) {
  commitSlider.addEventListener('input', onTimeSliderChange);
  onTimeSliderChange();
}
