---
layout: page
title: Create New Post
permalink: /create-post/
---

# Create New Blog Post

<form id="postForm" onsubmit="return createPost(event)">
  <div class="form-group">
    <label for="title">Post Title:</label>
    <input type="text" id="title" name="title" required class="form-control">
  </div>

  <div class="form-group">
    <label for="categories">Categories (comma-separated):</label>
    <input type="text" id="categories" name="categories" class="form-control">
  </div>

  <div class="form-group">
    <label for="content">Post Content (Markdown):</label>
    <textarea id="content" name="content" rows="10" required class="form-control"></textarea>
  </div>

  <button type="submit" class="btn btn-primary">Generate Post</button>
</form>

<div id="result" class="mt-4" style="display: none;">
  <h3>Your Post is Ready!</h3>
  <p>Copy the content below and create a new file in the <code>_posts</code> directory with the name format: <code>YYYY-MM-DD-title.md</code></p>
  <pre id="postContent" class="bg-light p-3 rounded"></pre>
  <button onclick="copyToClipboard()" class="btn btn-secondary">Copy to Clipboard</button>
</div>

<style>
.form-group {
  margin-bottom: 1rem;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.25rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  margin-top: 1rem;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>

<script>
function createPost(event) {
  event.preventDefault();
  
  const title = document.getElementById('title').value;
  const categories = document.getElementById('categories').value;
  const content = document.getElementById('content').value;
  
  const today = new Date();
  const date = today.toISOString().split('T')[0];
  const time = today.toTimeString().split(' ')[0];
  
  const postContent = `---
layout: post
title: "${title}"
date: ${date} ${time} -0000
categories: [${categories}]
---

${content}`;
  
  document.getElementById('postContent').textContent = postContent;
  document.getElementById('result').style.display = 'block';
  
  return false;
}

function copyToClipboard() {
  const postContent = document.getElementById('postContent');
  postContent.select();
  document.execCommand('copy');
  alert('Content copied to clipboard!');
}
</script> 