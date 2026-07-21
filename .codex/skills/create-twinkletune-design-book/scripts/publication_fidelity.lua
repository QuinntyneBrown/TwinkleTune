-- Keep Pandoc's Markdown interpretation authoritative for fidelity-sensitive nodes.

local html_elements = {
  a = true, abbr = true, address = true, area = true, article = true,
  aside = true, audio = true, b = true, base = true, bdi = true, bdo = true,
  blockquote = true, body = true, br = true, button = true, canvas = true,
  caption = true, cite = true, code = true, col = true, colgroup = true,
  data = true, datalist = true, dd = true, del = true, details = true,
  dfn = true, dialog = true, div = true, dl = true, dt = true, em = true,
  embed = true, fieldset = true, figcaption = true, figure = true,
  footer = true, form = true, h1 = true, h2 = true, h3 = true, h4 = true,
  h5 = true, h6 = true, head = true, header = true, hgroup = true,
  hr = true, html = true, i = true, iframe = true, img = true,
  input = true, ins = true, kbd = true, label = true, legend = true,
  li = true, link = true, main = true, map = true, mark = true,
  math = true, menu = true, meta = true, meter = true, nav = true,
  noscript = true, object = true, ol = true, optgroup = true,
  option = true, output = true, p = true, picture = true, pre = true,
  progress = true, q = true, rp = true, rt = true, ruby = true,
  s = true, samp = true, script = true, search = true, section = true,
  select = true, slot = true, small = true, source = true, span = true,
  strong = true, style = true, sub = true, summary = true, sup = true,
  svg = true, table = true, tbody = true, td = true, template = true,
  textarea = true, tfoot = true, th = true, thead = true, time = true,
  title = true, tr = true, track = true, u = true, ul = true, var = true,
  video = true, wbr = true,
}

function RawInline(raw)
  if raw.format ~= "html" then
    return nil
  end
  local tag = raw.text:match("^<([%a][%w:_-]*)>$")
  if tag and not html_elements[tag:lower()] then
    return pandoc.Str(raw.text)
  end
  return nil
end

function Figure(figure)
  local label = pandoc.utils.stringify(figure.caption.long)
  if label ~= "" then
    figure.attributes["aria-label"] = label
  end
  return figure
end
