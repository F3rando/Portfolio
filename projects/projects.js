import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

//  Load the data
const projects = await fetchJSON('../lib/projects.json');

let query = '';
let selectedYear = null;

function applyFilters(projectsGiven) {
  let filteredProjects = projectsGiven;

  if (query) {
    filteredProjects = filteredProjects.filter((project) => {
      let values = Object.values(project).join('\n').toLowerCase();
      return values.includes(query.toLowerCase());
    });
  }

  if (selectedYear !== null) {
    filteredProjects = filteredProjects.filter((project) => project.year === selectedYear);
  }

  return filteredProjects;
}

function renderPieChart(projectsGiven) {
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));

  let colors = d3.scaleOrdinal(d3.schemeTableau10).domain(data.map((d) => d.label));

  const pieSvg = d3.select('#projects-pie-plot');
  pieSvg.selectAll('path').remove();

  arcs.forEach((arc, idx) => {
    const year = data[idx]?.label ?? null;
    pieSvg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(year))
      .attr('class', year !== null && year === selectedYear ? 'selected' : '')
      .on('click', () => {
        selectedYear = selectedYear === year ? null : year;
        updateUI();
      });
  });

  let legend = d3.select('.legend');
  legend.selectAll('li').remove();

  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('class', d.label === selectedYear ? 'legend-item selected' : 'legend-item')
      .attr('style', `--color:${colors(d.label)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectedYear = selectedYear === d.label ? null : d.label;
        updateUI();
      });
  });
}

//  Find where the projects should go in the HTML
const projectsContainer = document.querySelector('.projects');

function updateUI() {
  const filteredProjects = applyFilters(projects);
  renderProjects(filteredProjects, projectsContainer, 'h3');
  renderPieChart(filteredProjects);
}

// Render on page load
updateUI();

// 1.6: Count and display the number of projects
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  projectsTitle.textContent = `Projects (${projects.length})`;
}

let searchInput = document.querySelector('.searchBar');
searchInput?.addEventListener('input', (event) => {
  query = event.target.value;
  updateUI();
});
