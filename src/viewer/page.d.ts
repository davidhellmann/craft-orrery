// What the page gives the viewer's scripts besides the browser's own globals (see src/templates/_viewer.twig): the content
// model, as Viewer::render() builds it.
interface Window {
  CONTENT_MODEL: any;
}
