console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 3: Dynamic Navigation Menu Generation
// Detect BASE_PATH based on hostname (localhost vs GitHub Pages)
const BASE_PATH = location.hostname === "localhost" 
  ? "" 
  : "/Portfolio";

// Array of page objects with url and title
const pages = [
  { url: `${BASE_PATH}/index.html`, title: "Home" },
  { url: `${BASE_PATH}/projects/index.html`, title: "Projects" },
  { url: `${BASE_PATH}/contact/index.html`, title: "Contact" },
  { url: `${BASE_PATH}/cv/index.html`, title: "CV" },
  { url: "https://github.com/F3rando", title: "GitHub" }
];

// Create nav element dynamically
const nav = document.createElement("nav");
const ul = document.createElement("ul");

// Use for...of loop to iterate through pages
for (const page of pages) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = page.url;
  a.textContent = page.title;
  
  // Toggle 'current' class if link matches current location
  a.classList.toggle("current", a.host === location.host && a.pathname === location.pathname);
  
  // Set target="_blank" for external links
  if (a.host !== location.host) {
    a.target = "_blank";
  }
  
  li.appendChild(a);
  ul.appendChild(li);
}

nav.appendChild(ul);
document.body.prepend(nav);

// Step 4: Theme Switcher
// Add theme switcher dropdown at the start of the body
document.body.insertAdjacentHTML('afterbegin', `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`);

// Get the select element
const colorSchemeSelect = document.querySelector('.color-scheme select');

// Function to set color scheme
function setColorScheme(color) {
  document.documentElement.style.colorScheme = color;
  colorSchemeSelect.value = color;
}

// Add event listener to the select
colorSchemeSelect.addEventListener('input', (event) => {
  const selectedColor = event.target.value;
  setColorScheme(selectedColor);
  localStorage.colorScheme = selectedColor;
});

// On page load, check for saved preference
if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// Step 5: Enhanced Contact Form Submission
// Find the form element (only exists on contact page)
const form = document.querySelector('form');

// Use optional chaining to add event listener safely
form?.addEventListener('submit', (event) => {
  // Prevent default browser form submission
  event.preventDefault();
  
  // Create FormData object from the form
  const formData = new FormData(form);
  
  // Initialize URL with the form's action (mailto:email)
  let url = form.action + '?';
  
  // Use for...of loop to iterate through form data
  let isFirst = true;
  for (const [name, value] of formData) {
    // Encode the value to handle special characters
    const encodedValue = encodeURIComponent(value);
    
    // Add & separator for subsequent fields
    if (!isFirst) {
      url += '&';
    }
    
    // Append name=value pair
    url += `${name}=${encodedValue}`;
    isFirst = false;
  }
  
  // Open user's mail client with the formatted data
  location.href = url;
});