import { fetchJSON, renderProjects, fetchGithubData } from './global.js';

// Load the projects from the lib folder
const projects = await fetchJSON('./lib/projects.json');

// Get only the first 3
const latestProjects = projects.slice(0, 3);

// Find the container on the home page
const projectsContainer = document.querySelector('.projects');

// Render them!
if (projectsContainer) {
    renderProjects(latestProjects, projectsContainer, 'h2');
}

const githubData = await fetchGithubData('F3rando');

const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  profileStats.innerHTML = `
        <dl>
          <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
          <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
          <dt>Followers:</dt><dd>${githubData.followers}</dd>
          <dt>Following:</dt><dd>${githubData.following}</dd>
        </dl>
    `;
}
