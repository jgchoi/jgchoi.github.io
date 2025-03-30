# My Personal Blog

This is my personal blog built with Jekyll and hosted on GitHub Pages.

## Local Development

To run this blog locally:

1. Install Ruby (version 2.5 or higher)
2. Install Bundler:
   ```bash
   gem install bundler
   ```
3. Install dependencies:
   ```bash
   bundle install
   ```
4. Run the development server:
   ```bash
   bundle exec jekyll serve
   ```
5. Visit `http://localhost:4000` in your browser

## Writing New Posts

To create a new blog post:

1. Create a new file in the `_posts` directory with the format: `YYYY-MM-DD-title.md`
2. Add the following front matter at the top of the file:
   ```yaml
   ---
   layout: post
   title: "Your Post Title"
   date: YYYY-MM-DD HH:MM:SS -0000
   categories: [category1, category2]
   ---
   ```
3. Write your content in Markdown format
4. Commit and push to GitHub

## Customization

- Edit `_config.yml` to change site settings
- Modify the theme in `_layouts` and `_includes` directories
- Add new pages by creating markdown files in the root directory

## Deployment

This site is automatically deployed through GitHub Pages. Simply push your changes to the main branch, and GitHub Pages will rebuild and deploy your site.

## License

This project is open source and available under the MIT License. 