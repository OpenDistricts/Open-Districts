const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Set a good viewport for the kiosk design
    await page.setViewport({ width: 1920, height: 1080 });

    const baseUrl = 'http://localhost:8080/moswasthya-sathi-v4.html';

    console.log('Navigating to', baseUrl);
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });

    await wait(4000); // Wait for the map to draw
    await page.screenshot({ path: 'map-initial.png' });
    console.log('Saved map-initial.png');

    // 2. State Search
    console.log('Typing in search...');
    await page.type('#hierarchy-search', 'Guja');
    await wait(1000); // Give time for search filter + glow
    await page.screenshot({ path: 'state-search.png' });
    console.log('Saved state-search.png');

    // Clear search manually before moving on
    await page.evaluate(() => {
        const srch = document.querySelector('#hierarchy-search');
        if (srch) {
            srch.value = '';
            srch.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await wait(500);

    // 3. Select a State (Gujarat = GJ)
    console.log('Selecting a state...');
    await page.evaluate(() => {
        // Try to find the Gujarat path, and trigger the state selection
        const statePath = document.querySelector('.state-path[data-id="GJ"]');
        if (statePath) {
            const event = new MouseEvent('dblclick', { bubbles: true, view: window });
            statePath.dispatchEvent(event);
        } else {
            // fallback, click first state
            const fallback = document.querySelector('.state-path');
            if (fallback) {
                const event = new MouseEvent('dblclick', { bubbles: true, view: window });
                fallback.dispatchEvent(event);
            }
        }
    });
    // Wait for animation to zoom into the state and show district selector window
    await wait(3000);
    await page.screenshot({ path: 'state-selected.png' });
    console.log('Saved state-selected.png');

    // 4. District Selected
    console.log('Selecting a district...');
    await page.evaluate(() => {
        // Now there should be district paths inside `.district-selector-svg` or `svg.map-svg.district-map` depending on the current implementation.
        // Actually, hierarchy-controller.js in v4 renders districts after a state is double-clicked into the side panel map or something.
        // Wait, the user's objective said: "spawning a district selector window upon state selection" and "double-click interaction for district selection ... stats bar slides in"
        // Let's just find the first district path and double-click it.
        const districtPath = document.querySelector('.district-selector-svg path.district-path');
        if (districtPath) {
            const event = new MouseEvent('dblclick', { bubbles: true, view: window });
            districtPath.dispatchEvent(event);
        } else {
            console.log('Could not find .district-path.');
        }
    });
    await wait(2000); // Wait for stats bar to slide in
    await page.screenshot({ path: 'district-selected.png' });
    console.log('Saved district-selected.png');

    // 5. Timeline Hover
    console.log('Hovering timeline...');
    await page.hover('.timeline-event');
    await wait(1000);
    await page.screenshot({ path: 'timeline-interaction.png' });
    console.log('Saved timeline-interaction.png');

    await browser.close();
})();
