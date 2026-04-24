import { fetchJSON, renderProjects } from '../global.js';
// 1. Load the data
const projects = await fetchJSON('../lib/projects.json');

// 2. Find where the projects should go in the HTML
const projectsContainer = document.querySelector('.projects');

// 3. Render them!
renderProjects(projects, projectsContainer, 'h3');

// 1.6: Count and display the number of projects
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  projectsTitle.textContent = `Projects (${projects.length})`;
}