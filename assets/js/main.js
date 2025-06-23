/*
	Jimmy Zeng, 31 Jan 2022
	Jimmy Zeng, 10 Feb 2022 - Timeline
	Jimmy Zeng, 22 Feb 2022 - DarkMode
*/
(function($) {

	var	$window = $(window),
		$body = $('body'),
		$wrapper = $('#wrapper'),
		$header = $('#header'),
		$nav = $('#nav'),
		$main = $('#main'),
		$navPanelToggle, $navPanel, $navPanelInner;

	// Breakpoints.
		breakpoints({
			default:   ['1681px',   null       ],
			xlarge:    ['1281px',   '1680px'   ],
			large:     ['981px',    '1280px'   ],
			medium:    ['737px',    '980px'    ],
			small:     ['481px',    '736px'    ],
			xsmall:    ['361px',    '480px'    ],
			xxsmall:   [null,       '360px'    ]
		});

	/**
	 * Applies parallax scrolling to an element's background image.
	 * @return {jQuery} jQuery object.
	 */
	$.fn._parallax = function(intensity) {

		var	$window = $(window),
			$this = $(this);

		if (this.length == 0 || intensity === 0)
			return $this;

		if (this.length > 1) {

			for (var i=0; i < this.length; i++)
				$(this[i])._parallax(intensity);

			return $this;

		}

		if (!intensity)
			intensity = 0.25;

		$this.each(function() {

			var $t = $(this),
				$bg = $('<div class="bg"></div>').appendTo($t),
				on, off;

			on = function() {

				$bg
					.removeClass('fixed')
					.css('transform', 'matrix(1,0,0,1,0,0)');

				$window
					.on('scroll._parallax', function() {

						var pos = parseInt($window.scrollTop()) - parseInt($t.position().top);

						$bg.css('transform', 'matrix(1,0,0,1,0,' + (pos * intensity) + ')');

					});

			};

			off = function() {

				$bg
					.addClass('fixed')
					.css('transform', 'none');

				$window
					.off('scroll._parallax');

			};

			// Disable parallax on ..
				if (browser.name == 'ie'			// IE
				||	browser.name == 'edge'			// Edge
				||	window.devicePixelRatio > 1		// Retina/HiDPI (= poor performance)
				||	browser.mobile)					// Mobile devices
					off();

			// Enable everywhere else.
				else {

					breakpoints.on('>large', on);
					breakpoints.on('<=large', off);

				}

		});

		$window
			.off('load._parallax resize._parallax')
			.on('load._parallax resize._parallax', function() {
				$window.trigger('scroll');
			});

		return $(this);

	};

	// Play initial animations on page load.
		$window.on('load', function() {
			window.setTimeout(function() {
				$body.removeClass('is-preload');
			}, 100);
		});

	// Scrolly.
		$('.scrolly').scrolly();

	// Background.
		$wrapper._parallax(0.925);

	// Nav Panel.

		// Toggle.
			$navPanelToggle = $(
				'<a href="#navPanel" id="navPanelToggle">Menu</a>'
			)
				.appendTo($wrapper);

			// Change toggle styling once we've scrolled past the header.
				$header.scrollex({
					bottom: '5vh',
					enter: function() {
						$navPanelToggle.removeClass('alt');
					},
					leave: function() {
						$navPanelToggle.addClass('alt');
					}
				});

		// Panel.
			$navPanel = $(
				'<div id="navPanel">' +
					'<nav>' +
					'</nav>' +
					'<a href="#navPanel" class="close"></a>' +
				'</div>'
			)
				.appendTo($body)
				.panel({
					delay: 500,
					hideOnClick: true,
					hideOnSwipe: true,
					resetScroll: true,
					resetForms: true,
					side: 'right',
					target: $body,
					visibleClass: 'is-navPanel-visible'
				});

			// Get inner.
				$navPanelInner = $navPanel.children('nav');

			// Move nav content on breakpoint change.
				var $navContent = $nav.children();

				breakpoints.on('>medium', function() {

					// NavPanel -> Nav.
						$navContent.appendTo($nav);

					// Flip icon classes.
						$nav.find('.icons, .icon')
							.removeClass('alt');

				});

				breakpoints.on('<=medium', function() {

					// Nav -> NavPanel.
						$navContent.appendTo($navPanelInner);

					// Flip icon classes.
						$navPanelInner.find('.icons, .icon')
							.addClass('alt');

				});

			// Hack: Disable transitions on WP.
				if (browser.os == 'wp'
				&&	browser.osVersion < 10)
					$navPanel
						.css('transition', 'none');

	// Intro.
		var $intro = $('#intro');

		if ($intro.length > 0) {

			// Hack: Fix flex min-height on IE.
				if (browser.name == 'ie') {
					$window.on('resize.ie-intro-fix', function() {

						var h = $intro.height();

						if (h > $window.height())
							$intro.css('height', 'auto');
						else
							$intro.css('height', h);

					}).trigger('resize.ie-intro-fix');
				}

			// Hide intro on scroll (> small).
				breakpoints.on('>small', function() {

					$main.unscrollex();

					$main.scrollex({
						mode: 'bottom',
						top: '25vh',
						bottom: '-50vh',
						enter: function() {
							$intro.addClass('hidden');
						},
						leave: function() {
							$intro.removeClass('hidden');
						}
					});

				});

			// Hide intro on scroll (<= small).
				breakpoints.on('<=small', function() {

					$main.unscrollex();

					$main.scrollex({
						mode: 'middle',
						top: '15vh',
						bottom: '-15vh',
						enter: function() {
							$intro.addClass('hidden');
						},
						leave: function() {
							$intro.removeClass('hidden');
						}
					});

			});

		}

})(jQuery);


function toggleTimeline() {
	var x = document.getElementById("timeline");
	var btn = document.getElementById("showTimeline");

  	if (x.style.display === "none") {
		x.style.display = "flex"
		x.style.transition = "3s";
		btn.innerText="hide";
  	}
	else {
    	x.style.display = "none";
		btn.innerText="show";
  	}
}


// check for saved 'darkMode' in localStorage
let darkMode = localStorage.getItem('darkMode'); 

const darkModeToggle = document.querySelector('#dark-mode-toggle');

const enableDarkMode = () => {
  // 1. Add the class to the body
  document.body.classList.add('dark-mode');
  // 2. Update darkMode in localStorage
  localStorage.setItem('darkMode', 'enabled');
}

const disableDarkMode = () => {
  // 1. Remove the class from the body
  document.body.classList.remove('dark-mode');
  // 2. Update darkMode in localStorage 
  localStorage.setItem('darkMode', null);
}
 
// If the user already visited and enabled darkMode
// start things off with it on
if (darkMode === 'enabled') {
  	enableDarkMode();
	darkModeToggle.classList.toggle("fa-sun");
}

// When someone clicks the button
darkModeToggle.addEventListener('click', () => {
  // get their darkMode setting
  darkMode = localStorage.getItem('darkMode'); 
  
  // if it not current enabled, enable it
  if (darkMode !== 'enabled') {
	enableDarkMode();
  // if it has been enabled, turn it off  
  } else {  
	disableDarkMode();
  }
});

function myFunction(x) {
	x.classList.toggle("fa-sun");
	console.log("pressed")
}

function loadHTML(url, elementId) {
	fetch(url)
		.then(response => response.text())
		.then(data => {
			document.getElementById(elementId).innerHTML = data;
		})
		.catch(error => console.error('Error loading HTML:', error));
}

// DOM Content Functions
document.addEventListener("DOMContentLoaded", function() {
	// loadHTML('social.html', 'social-section');
	// loadHTML('sitemap.html', 'sitemap-section');
	loadHTML('footer.html', 'footer-container');

	fetch('contents/proj_articles.json')
		.then(response => response.json())
		.then(data => {
			const articlesContainer = document.getElementById('articles');
			const portfolioWebsite = document.getElementById("website");
			const portfolioPublications = document.getElementById("publications");
			let articlesPerPage = 4;
			let currentPage = 1;

			// Calculate total pages based on the maximum articles per page (6)
			const totalPages = Math.ceil((data.length - 4) / 6) + 1;

			function getQueryParam(param) {
				const urlParams = new URLSearchParams(window.location.search);
				return urlParams.get(param);
			}

			function showPage(page) {
				if (page === 1) {
					articlesPerPage = 4;
				} else {
					articlesPerPage = 6;
				}

			articlesContainer.innerHTML = ''; // Clear existing articles

			data.forEach((article, index) => {
				if ((page === 1 && index < articlesPerPage) || 
					(page > 1 && index >= 4 + (page - 2) * articlesPerPage && index < 4 + (page - 1) * articlesPerPage)) {
					
					const articleElement = document.createElement('article');
					articleElement.id = `article_${index + 1}`;
					let mediaContent = '';

					if (article.video) {
						mediaContent = `
							<div class="container">
								<iframe width="100%" height="100%" class="embedVideo" src="${article.video}" alt="${article.alt}" title="${article.alt_title}" allowfullscreen></iframe>
							</div>`;
					} else if (article.image) {
						mediaContent = `<img src="${article.image}" alt="${article.alt}" title="${article.alt_title}" class="image fit" />`;
					} else if (article.figma) {
						mediaContent = `<iframe width="100%" height="800px" src="${article.figma}" alt="${article.alt}" title="${article.alt_title}" allowfullscreen></iframe>`;
					}

					articleElement.innerHTML = `
						<header>
							<h2 style="text-transform: none"><a href="${article.link}">${article.title}<br />
								<h4>${article.subtitle}</h4></a></h2>
						</header>
						${mediaContent}
						<p>${article.description}</p>
						<ul class="actions special"><li><a href="${article.buttonLink}" class="button" ${article.download ? 'download' : ''}>${article.buttonText}</a></li></ul>
					`;
					articlesContainer.appendChild(articleElement);
					}
				});

				if (page === 1) {
					portfolioWebsite.style.display = 'block';
					portfolioPublications.style.display = 'block';
				} else {
					portfolioWebsite.style.display = 'none';
					portfolioPublications.style.display = 'none';
				}

				createPagination();

				// Invoke callback if provided
				if (callback) callback();
			}

			function createPagination() {
				const pagination = document.getElementById("pages");
				pagination.innerHTML = '';

				if (currentPage > 1) {
					const prevLink = document.createElement('a');
					prevLink.textContent = 'Prev';
					prevLink.href = "#";
					prevLink.className = 'previous';
					prevLink.addEventListener('click', function(e) {
						e.preventDefault();
						currentPage--;
						showPage(currentPage);
					});
					pagination.appendChild(prevLink);
				}

				for (let i = 1; i <= totalPages; i++) {
					const pageLink = document.createElement('a');
					pageLink.textContent = i;
					pageLink.href = "#";
					pageLink.className = 'page';
					if (i === currentPage) pageLink.classList.add('active');
					pageLink.addEventListener('click', function(e) {
						e.preventDefault();
						currentPage = i;
						showPage(currentPage);
					});
					pagination.appendChild(pageLink);
				}

				if (currentPage < totalPages) {
					const nextLink = document.createElement('a');
					nextLink.textContent = 'Next';
					nextLink.href = "#";
					nextLink.className = 'next';
					nextLink.addEventListener('click', function(e) {
						e.preventDefault();
						currentPage++;
						showPage(currentPage);
					});
					pagination.appendChild(nextLink);
				}
			}

			const targetArticle = getQueryParam('article');
			if (targetArticle) {
				const articleNumber = parseInt(targetArticle.replace("article_", ""));
				const totalArticles = data.length;

				if (articleNumber >= 1 && articleNumber <= totalArticles) {
					// Determine target page
					const targetPage = (articleNumber <= 4) ? 1 : Math.ceil((articleNumber - 4) / 6) + 1;
					currentPage = targetPage;

					// Show target page and scroll after content loads
					showPage(currentPage, () => {
						const el = document.getElementById(targetArticle);
						if (el) {
							el.scrollIntoView({ behavior: 'smooth' });
						}
					});
				} else {
					// Fallback if invalid number
					showPage(currentPage);
				}
			} else {
				// No param, normal first load
				showPage(currentPage);
			}
		})
		.catch(error => console.error('Error loading articles:', error));
});	

	

document.querySelectorAll('.load-iframe').forEach(title => {
  title.addEventListener('click', () => {

    const container = title.nextElementSibling;

    // If iframe hasn't been loaded yet, create and insert it
    if (!container.querySelector('iframe')) {
      const iframe = document.createElement('iframe');
      iframe.src = title.getAttribute('data-src');
      iframe.width = "100%";
      iframe.height = "800";
      iframe.frameBorder = "0";
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }

    // Toggle show/hide iframe container
    if (container.style.display === "none" || container.style.display === "") {
      container.style.display = "block";

      // Scroll to title only when showing the iframe
      title.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } else {
      container.style.display = "none";
    }
  });
});