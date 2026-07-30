const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Academy catalogue keeps discovery, resume, account, and mobile navigation wired', () => {
  const page = read('streams.html');
  const styles = read('streams.css');
  const client = read('streams.js');

  for (const id of ['academyMenu', 'academyNav', 'academyNavBackdrop', 'academyResume', 'resumeGrid', 'library']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(page, /streams\.css\?v=academy-20260729-3/);
  assert.match(page, /streams\.js\?v=academy-20260729-3/);
  assert.ok(page.indexOf('id="library"') < page.indexOf('id="featuredLesson"'));
  assert.match(client, /jz-academy-last-lesson/);
  assert.match(client, /jz-academy-progress/);
  assert.match(client, /\/api\/account\/me/);
  assert.match(client, /\/api\/store-settings/);
  assert.match(client, /function resumeHref/);
  assert.match(client, /function setAcademyMenu/);
  assert.match(styles, /\.academy-header\s*\{[\s\S]*position:fixed/);
  assert.match(styles, /\.academy-nav-backdrop/);
  assert.match(styles, /\.academy-resume-grid/);
});

test('Academy player keeps notes, resume state, progress, tabs, and mobile curriculum wired', () => {
  const page = read('learn.html');
  const styles = read('learn.css');
  const client = read('learn.js');

  for (const id of [
    'headerCourseTitle',
    'headerProgressRing',
    'headerProgressValue',
    'curriculumPanel',
    'curriculumClose',
    'curriculumOverlay',
    'lessonNotes',
    'notesStatus',
    'overviewTab',
    'notesTab',
    'resourcesTab',
    'courseReviewList'
  ]) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(page, /learn\.css\?v=academy-20260729-3/);
  assert.match(page, /learn\.js\?v=academy-20260729-3/);
  assert.ok(page.indexOf('id="courseReviewList"') > page.indexOf('id="learningSpace"'));
  assert.match(client, /jz-academy-notes/);
  assert.match(client, /jz-academy-last-lesson/);
  assert.match(client, /jz-academy-video-position/);
  assert.match(client, /history\.pushState/);
  assert.match(client, /\/api\/account\/progress/);
  assert.match(client, /setActiveLessonTab/);
  assert.match(client, /curriculum-open/);
  assert.match(client, /headerProgressRing/);
  assert.match(styles, /\.learn-header\s*\{[\s\S]*position:\s*sticky/);
  assert.match(styles, /\.learning-space\.curriculum-open \.curriculum-panel/);
  assert.match(styles, /\.lesson-tabs/);
  assert.match(styles, /\.lesson-notes/);
});
