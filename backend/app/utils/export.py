import io
import re
import os
import urllib.request
from fastapi import status
from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException


UNICODE_TO_SUB = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")",
    "ₐ": "a", "ₑ": "e", "ₕ": "h", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₗ": "l", "ₘ": "m", "ₙ": "n", "ₒ": "o", "ₚ": "p", "ᵣ": "r", "ₛ": "s", "ₜ": "t", "ᵤ": "u", "ᵥ": "v", "ₓ": "x"
}

UNICODE_TO_SUP = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")", "ⁿ": "n", "ˣ": "x", "ⁱ": "i"
}


def format_unicode_sub_sup_html(text: str) -> str:
    """Translate Unicode subscripts/superscripts to ReportLab HTML tags."""
    if not text or not isinstance(text, str):
        return str(text) if text is not None else ""

    res = []
    i = 0
    while i < len(text):
        char = text[i]
        if char in UNICODE_TO_SUB:
            sub_chars = []
            while i < len(text) and text[i] in UNICODE_TO_SUB:
                sub_chars.append(UNICODE_TO_SUB[text[i]])
                i += 1
            res.append(f"<sub>{''.join(sub_chars)}</sub>")
        elif char in UNICODE_TO_SUP:
            sup_chars = []
            while i < len(text) and text[i] in UNICODE_TO_SUP:
                sup_chars.append(UNICODE_TO_SUP[text[i]])
                i += 1
            res.append(f"<sup>{''.join(sup_chars)}</sup>")
        else:
            res.append(char)
            i += 1

    return "".join(res)


def get_image_flowable_or_run(url: str, max_width: float = 490, max_height: float = 650, scale: float = 1.0):
    """Retrieve image flowable for ReportLab PDF or path/bytes for python-docx.
    
    If the image is a URL, it fetches it via requests (with fallback).
    If it is local, it reads it directly from the disk.
    """
    from reportlab.platypus import Image
    from PIL import Image as PILImage
    
    is_remote = url.startswith("http://") or url.startswith("https://")
    img_data = None
    
    if is_remote:
        try:
            import ssl
            context = ssl._create_unverified_context()
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            with urllib.request.urlopen(req, timeout=15, context=context) as response:
                img_data = io.BytesIO(response.read())
        except Exception as e:
            print(f"Failed to fetch remote image {url}: {e}")
            return None
    else:
        # For local paths (e.g. /uploads/filename.png)
        local_path = url.lstrip("/")
        if os.path.exists(local_path):
            try:
                with open(local_path, "rb") as f:
                    img_data = io.BytesIO(f.read())
            except Exception as e:
                print(f"Failed to read local image {local_path}: {e}")
                return None
        else:
            filename = os.path.basename(local_path)
            fallback_path = os.path.join("uploads", filename)
            if os.path.exists(fallback_path):
                try:
                    with open(fallback_path, "rb") as f:
                        img_data = io.BytesIO(f.read())
                except Exception as e:
                    print(f"Failed to read local image {fallback_path}: {e}")
                    return None
                    
    if not img_data:
        return None
        
    try:
        pil_img = PILImage.open(img_data)
        width, height = pil_img.size
        # Apply scaling factor (e.g. for high DPI print sizes)
        width_pt = width * scale
        height_pt = height * scale
        # Only scale down if width or height exceeds maximum bounds
        ratio = min(1.0, max_width / width_pt, max_height / height_pt)
        new_width = width_pt * ratio
        new_height = height_pt * ratio
        img_data.seek(0)
        return Image(img_data, width=new_width, height=new_height), img_data, new_width, new_height
    except Exception as e:
        print(f"Failed to process image size: {e}")
        return None


def format_latex_for_export(input_latex: str) -> str:
    """Preprocess raw user LaTeX / natural math string for export rendering.
    Mirrors frontend KatexRenderer formatLatexForKatex logic:
    1. Formats multi-line equations into \\begin{aligned} ... \\end{aligned}
    2. Auto-anchors '=' with '&=' so all equals signs align vertically down the left side
    3. Handles natural math shortcuts like (a)/(b) -> \\frac{a}{b} if not already LaTeX
    4. Preserves consecutive spaces
    """
    if not input_latex:
        return ""
    processed = input_latex.strip()
    if not processed:
        return ""

    is_multi_line = "\n" in processed or "\\\\" in processed

    if is_multi_line and "\\begin{" not in processed:
        raw_lines = re.split(r"\n|\\\\", processed)
        formatted_lines = []
        consecutive_empties = 0

        for line in raw_lines:
            trimmed = line.strip()

            if not trimmed:
                consecutive_empties += 1
                if consecutive_empties <= 1:
                    formatted_lines.append("&")
                continue

            consecutive_empties = 0

            # Convert simple fraction shortcut e.g. (5+5+6)/(8+10) or 16/18 to \frac{...}{...}
            if "\\frac" not in trimmed and "/" in trimmed:
                trimmed = re.sub(r"\(([^)]+)\)/\(([^)]+)\)", r"\\frac{\1}{\2}", trimmed)
                trimmed = re.sub(r"\b([a-zA-Z0-9._+]+)\b/\b([a-zA-Z0-9._+]+)\b", r"\\frac{\1}{\2}", trimmed)

            # Auto-anchor '=' for vertical alignment in KaTeX aligned environment
            if trimmed.startswith("="):
                trimmed = "&" + trimmed
            elif "=" in trimmed and "&=" not in trimmed:
                trimmed = trimmed.replace("=", " &=", 1)
            elif not trimmed.startswith("&"):
                trimmed = "& " + trimmed

            # Preserve consecutive spaces inside line
            trimmed = re.sub(r"(?<!\\)( {2,})", lambda m: " \\ " * len(m.group(1)), trimmed)

            formatted_lines.append(trimmed)

        processed = "\\begin{aligned}\n" + " \\\\\n".join(formatted_lines) + "\n\\end{aligned}"
    else:
        # Single line mode fraction shortcut & space preservation
        if "\\frac" not in processed and "/" in processed:
            processed = re.sub(r"\(([^)]+)\)/\(([^)]+)\)", r"\\frac{\1}{\2}", processed)
            processed = re.sub(r"\b([a-zA-Z0-9._+]+)\b/\b([a-zA-Z0-9._+]+)\b", r"\\frac{\1}{\2}", processed)
        processed = re.sub(r"(?<!\\)( {2,})", lambda m: " \\ " * len(m.group(1)), processed)

    return processed


def get_equation_image_flowable_or_run(latex_str: str, max_width: float = 450, max_height: float = 350):
    """Fetch high-fidelity mathematical LaTeX rendered PNG from public CodeCogs API.
    
    Returns ReportLab Flowable and file data, or None if network/fetch fails.
    """
    if not latex_str:
        return None
    import urllib.parse
    
    formatted_latex = format_latex_for_export(latex_str)
    if not formatted_latex:
        return None

    raw_lines = [l.strip() for l in latex_str.strip().strip("$").split("\n") if l.strip()]
    dynamic_max_height = max(max_height, len(raw_lines) * 45)
    query_str = f"\\dpi{{150}}\\bg{{ffffff}} {formatted_latex}"
    encoded_query = urllib.parse.quote(query_str)
    url = f"https://latex.codecogs.com/png.image?{encoded_query}"
    return get_image_flowable_or_run(url, max_width=max_width, max_height=dynamic_max_height, scale=72/150)


def convert_latex_to_unicode(latex: str) -> str:
    """Convert a LaTeX math string to a readable Unicode representation.

    This performs a best-effort translation of common LaTeX math notation
    into Unicode characters so that PDF and DOCX exports display readable
    math instead of raw LaTeX source code.
    """
    if not latex:
        return ""

    text = latex.strip()

    # --- Remove alignment markers & display-math delimiters ---
    text = text.replace("&=", "=").replace("&", "").strip("$").strip()

    # --- Matrices: \begin{pmatrix} a & b \\ c & d \end{pmatrix} ---
    def _render_matrix(m: re.Match) -> str:
        body = m.group(1).strip()
        rows = [r.strip() for r in body.split("\\\\")]
        rendered_rows = []
        for row in rows:
            cells = [c.strip() for c in row.split("&")]
            rendered_rows.append("  ".join(cells))
        if len(rendered_rows) == 1:
            return "(" + rendered_rows[0] + ")"
        lines = []
        for i, row in enumerate(rendered_rows):
            if i == 0:
                lines.append("⎛ " + row + " ⎞")
            elif i == len(rendered_rows) - 1:
                lines.append("⎝ " + row + " ⎠")
            else:
                lines.append("⎜ " + row + " ⎟")
        return "\n".join(lines)

    # Process pmatrix, bmatrix, vmatrix, matrix
    text = re.sub(
        r"\\begin\{[pbvBV]?matrix\}(.+?)\\end\{[pbvBV]?matrix\}",
        _render_matrix,
        text,
        flags=re.DOTALL,
    )

    # --- Fractions: \frac{a}{b} -> a/b ---
    def _render_frac(m: re.Match) -> str:
        num = m.group(1)
        den = m.group(2)
        return f"({num}/{den})"

    text = re.sub(r"\\frac\{([^}]*)\}\{([^}]*)\}", _render_frac, text)

    # --- Square roots: \sqrt{x} -> √(x), \sqrt[n]{x} -> ⁿ√(x) ---
    superscript_digits = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
    text = re.sub(
        r"\\sqrt\s*\[([^\]]*)\]\{([^}]*)\}",
        lambda m: m.group(1).translate(superscript_digits) + "√(" + m.group(2) + ")",
        text,
    )
    text = re.sub(r"\\sqrt\s*\{([^}]*)\}", r"√(\1)", text)
    text = re.sub(r"\\sqrt\s*([a-zA-Z0-9])", r"√\1", text)  # \sqrt x or \sqrtx shorthand

    # --- Integrals and limits ---
    text = re.sub(r"\\int_\{([^}]*)\}\^\{([^}]*)\}", r"∫[\1→\2]", text)
    text = re.sub(r"\\int", "∫", text)
    text = re.sub(r"\\sum_\{([^}]*)\}\^\{([^}]*)\}", r"∑[\1→\2]", text)
    text = re.sub(r"\\sum", "∑", text)
    text = re.sub(r"\\prod_\{([^}]*)\}\^\{([^}]*)\}", r"∏[\1→\2]", text)
    text = re.sub(r"\\prod", "∏", text)
    text = re.sub(r"\\lim_\{([^}]*)\}", r"lim(\1)", text)
    text = re.sub(r"\\lim", "lim", text)

    # --- Greek letters ---
    greek = {
        "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ",
        "epsilon": "ε", "zeta": "ζ", "eta": "η", "theta": "θ",
        "iota": "ι", "kappa": "κ", "lambda": "λ", "mu": "μ",
        "nu": "ν", "xi": "ξ", "pi": "π", "rho": "ρ",
        "sigma": "σ", "tau": "τ", "upsilon": "υ", "phi": "φ",
        "chi": "χ", "psi": "ψ", "omega": "ω",
        "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ",
        "Xi": "Ξ", "Pi": "Π", "Sigma": "Σ", "Phi": "Φ",
        "Psi": "Ψ", "Omega": "Ω",
        "varepsilon": "ε", "varphi": "φ", "vartheta": "ϑ",
    }
    for cmd, char in greek.items():
        text = text.replace(f"\\{cmd}", char)

    # --- Common math operators & symbols ---
    symbols = {
        "\\times": "×", "\\div": "÷", "\\cdot": "·",
        "\\pm": "±", "\\mp": "∓", "\\leq": "≤", "\\geq": "≥",
        "\\neq": "≠", "\\approx": "≈", "\\equiv": "≡",
        "\\infty": "∞", "\\partial": "∂", "\\nabla": "∇",
        "\\forall": "∀", "\\exists": "∃", "\\in": "∈",
        "\\notin": "∉", "\\subset": "⊂", "\\supset": "⊃",
        "\\cup": "∪", "\\cap": "∩", "\\emptyset": "∅",
        "\\rightarrow": "→", "\\leftarrow": "←",
        "\\Rightarrow": "⇒", "\\Leftarrow": "⇐",
        "\\leftrightarrow": "↔", "\\Leftrightarrow": "⇔",
        "\\therefore": "∴", "\\because": "∵",
        "\\angle": "∠", "\\perp": "⊥", "\\parallel": "∥",
        "\\triangle": "△", "\\circ": "°",
        "\\ldots": "…", "\\cdots": "⋯", "\\vdots": "⋮",
        "\\to": "→",
    }
    for cmd, char in symbols.items():
        text = text.replace(cmd, char)

    # --- Superscripts: ^{...} or ^x ---
    sup_map = str.maketrans(
        "0123456789+-=()aeinox",
        "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵉⁱⁿᵒˣ",
    )

    def _render_sup(m: re.Match) -> str:
        content = m.group(1)
        translated = content.translate(sup_map)
        if translated != content:
            return translated
        return f"^({content})"

    text = re.sub(r"\^\{([^}]*)\}", _render_sup, text)
    text = re.sub(r"\^([0-9])", lambda m: m.group(1).translate(sup_map), text)

    # --- Subscripts: _{...} or _x ---
    sub_map = str.maketrans(
        "0123456789+-=()aeioux",
        "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑᵢₒᵤₓ",
    )

    def _render_sub(m: re.Match) -> str:
        content = m.group(1)
        translated = content.translate(sub_map)
        if translated != content:
            return translated
        return f"_({content})"

    text = re.sub(r"_\{([^}]*)\}", _render_sub, text)
    text = re.sub(r"_([0-9])", lambda m: m.group(1).translate(sub_map), text)

    # --- Clean up remaining structural LaTeX ---
    text = re.sub(r"\\(?:left|right|big|Big|bigg|Bigg)([|()\[\]{}.])", r"\1", text)
    text = re.sub(r"\\(?:left|right|big|Big|bigg|Bigg)", "", text)
    text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
    text = re.sub(r"\\mathrm\{([^}]*)\}", r"\1", text)
    text = re.sub(r"\\mathbf\{([^}]*)\}", r"\1", text)
    text = re.sub(r"\\[a-zA-Z]+", "", text)  # Remove any remaining unknown commands
    text = text.replace("{", "").replace("}", "")  # Strip leftover braces
    # Strip space at the beginning and end of each line and normalize horizontal whitespace
    lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t\r\f\v]+", " ", line).strip()
        lines.append(line)
    text = "\n".join(lines).strip()

    return text

def generate_pdf_bytes(journal: dict, student_name: str, classroom_name: str) -> bytes:
    """Generate academic PDF document from block structure using ReportLab."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
    except ImportError:
        raise AppException(
            code=ErrorCode.EXPORT_FAILED,
            message="Export PDF engine dependencies (ReportLab) are currently compiling/downloading on the server. Please retry in 30 seconds.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Styles for Academic Theme
    title_style = ParagraphStyle(
        "JournalTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#1f2937"),
        spaceAfter=15,
    )

    meta_style = ParagraphStyle(
        "JournalMeta",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#4b5563"),
        spaceAfter=30,
    )

    h1_style = ParagraphStyle(
        "BlockH1",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#111827"),
        spaceBefore=15,
        spaceAfter=8,
    )

    h2_style = ParagraphStyle(
        "BlockH2",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#374151"),
        spaceBefore=12,
        spaceAfter=6,
    )

    p_style = ParagraphStyle(
        "BlockBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#374151"),
        spaceAfter=10,
    )

    code_style = ParagraphStyle(
        "BlockCode",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#111827"),
        spaceAfter=10,
    )

    card_title_style = ParagraphStyle(
        "CardTitle", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=colors.HexColor("#111827")
    )

    equation_style = ParagraphStyle(
        "BlockEquation",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        alignment=1, # Centered
        textColor=colors.HexColor("#1e3a8a"),
        spaceBefore=10,
        spaceAfter=10,
    )

    story = []

    # 1. Cover Info
    story.append(Paragraph(format_unicode_sub_sup_html(journal.get("title", "Practical Lab Journal")), title_style))
    date_str = (
        journal.get("updatedAt", "").split("T")[0]
        if isinstance(journal.get("updatedAt"), str)
        else "N/A"
    )
    story.append(
        Paragraph(
            format_unicode_sub_sup_html(f"Student Name: {student_name}<br/>Classroom: {classroom_name}<br/>Date: {date_str}"),
            meta_style,
        )
    )
    story.append(Spacer(1, 10))

    # 2. Iterate blocks
    for block in journal.get("blocks", []):
        b_type = block.get("type")
        b_content = block.get("content", {})

        if b_type == "heading":
            lvl = b_content.get("level", 1)
            text = format_unicode_sub_sup_html(b_content.get("text", ""))
            style = h1_style if lvl == 1 else h2_style
            story.append(Paragraph(text, style))

        elif b_type == "paragraph":
            text = format_unicode_sub_sup_html(b_content.get("text", "")).replace("\n", "<br/>")
            story.append(Paragraph(text, p_style))

        elif b_type == "code":
            code = b_content.get("code", "")
            p_code = Paragraph(
                f"<font face='Courier'>{code.replace('\n', '<br/>').replace(' ', '&nbsp;')}</font>",
                code_style,
            )
            t = Table([[p_code]], colWidths=[500])
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f3f4f6")),
                        ("PADDING", (0, 0), (-1, -1), 8),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 8))

        elif b_type == "observation" or b_type == "result":
            title = "Observation" if b_type == "observation" else "Result"
            val = format_unicode_sub_sup_html(b_content.get("text", "")).replace("\n", "<br/>")
            bg_color = (
                colors.HexColor("#eff6ff")
                if b_type == "observation"
                else colors.HexColor("#f0fdf4")
            )
            border_color = (
                colors.HexColor("#bfdbfe")
                if b_type == "observation"
                else colors.HexColor("#bbf7d0")
            )

            p_title = Paragraph(title, card_title_style)
            p_val = Paragraph(val, p_style)

            t = Table([[p_title], [p_val]], colWidths=[500])
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), bg_color),
                        ("PADDING", (0, 0), (-1, -1), 10),
                        ("BOX", (0, 0), (-1, -1), 1, border_color),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 8))

        elif b_type == "table":
            headers = b_content.get("headers", [])
            rows = b_content.get("rows", [])
            if not headers:
                continue

            # Build Table data
            data = []
            data.append([Paragraph(format_unicode_sub_sup_html(h), card_title_style) for h in headers])
            for r in rows:
                row_data = []
                for c_idx, h in enumerate(headers):
                    if isinstance(r, list):
                        val = r[c_idx] if c_idx < len(r) else ""
                    elif isinstance(r, dict):
                        val = r.get(h, "")
                    else:
                        val = ""
                    row_data.append(Paragraph(format_unicode_sub_sup_html(str(val)), p_style))
                data.append(row_data)

            t = Table(data, colWidths=[500 / len(headers)] * len(headers))
            t_styles = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
            for r_idx in range(1, len(data)):
                bg = colors.white if r_idx % 2 == 1 else colors.HexColor("#f8fafc")
                t_styles.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))
            t.setStyle(TableStyle(t_styles))
            story.append(t)
            story.append(Spacer(1, 8))

        elif b_type == "image":
            raw_images = b_content.get("images", [])
            main_caption = b_content.get("mainCaption", "") or b_content.get("caption", "")
            
            if not raw_images and b_content.get("url"):
                raw_images = [{"url": b_content.get("url"), "caption": b_content.get("caption", "")}]

            if raw_images:
                num_imgs = len(raw_images)
                max_w_per_img = 490.0 / min(num_imgs, 3)

                table_cells = []
                sub_caption_style = ParagraphStyle(
                    "SubImageCaption",
                    parent=p_style,
                    fontName="Helvetica-Oblique",
                    fontSize=8.5,
                    alignment=1, # Centered
                    textColor=colors.HexColor("#4b5563")
                )

                for idx, img_info in enumerate(raw_images):
                    img_url = img_info.get("url", "")
                    sub_cap = img_info.get("caption", "")
                    if not img_url:
                        continue

                    res = get_image_flowable_or_run(img_url, max_width=max_w_per_img - 10, max_height=300)
                    if res:
                        img_flowable, _, _, _ = res
                        cell_content = [img_flowable]
                        if sub_cap:
                            label = chr(97 + idx)
                            cell_content.append(Spacer(1, 2))
                            cell_content.append(Paragraph(format_unicode_sub_sup_html(f"({label}) {sub_cap}"), sub_caption_style))
                        table_cells.append(cell_content)

                if table_cells:
                    col_width = 490.0 / len(table_cells)
                    img_table = Table([table_cells], colWidths=[col_width] * len(table_cells))
                    img_table.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 2),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ]))
                    story.append(img_table)
                    story.append(Spacer(1, 4))

                    if main_caption:
                        main_caption_style = ParagraphStyle(
                            "MainImageCaption",
                            parent=p_style,
                            fontName="Helvetica-Bold",
                            fontSize=9,
                            alignment=1, # Centered
                            textColor=colors.HexColor("#374151")
                        )
                        story.append(Paragraph(format_unicode_sub_sup_html(main_caption), main_caption_style))
                    story.append(Spacer(1, 10))

        elif b_type == "page_break":
            from reportlab.platypus import PageBreak
            story.append(PageBreak())

        elif b_type == "reference":
            text = format_unicode_sub_sup_html(b_content.get("text", ""))
            ref_style = ParagraphStyle(
                "BlockReference",
                parent=p_style,
                fontName="Helvetica-Oblique",
                fontSize=9.5,
                leading=14,
                textColor=colors.HexColor("#4b5563"),
            )
            rt = Table([[Paragraph(f"🔖 <i>{text}</i>", ref_style)]], colWidths=[500])
            rt.setStyle(
                TableStyle(
                    [
                        ("LINEBEFORE", (0, 0), (0, -1), 3, colors.HexColor("#cbd5e1")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 10),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ]
                )
            )
            story.append(rt)
            story.append(Spacer(1, 8))

        elif b_type == "equation":
            latex_str = b_content.get("latex", "")
            img_res = get_equation_image_flowable_or_run(latex_str, max_width=450, max_height=120)
            if img_res:
                img_flowable, _, new_w, new_h = img_res
                # Center it inside a transparent table
                t = Table([[img_flowable]], colWidths=[500])
                t.setStyle(
                    TableStyle(
                        [
                            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                            ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ]
                    )
                )
                story.append(t)
                story.append(Spacer(1, 8))
            else:
                display_str = convert_latex_to_unicode(latex_str)
                # Handle multi-line output (e.g. rendered matrices)
                for eq_line in display_str.split("\n"):
                    p_eq = Paragraph(format_unicode_sub_sup_html(eq_line), equation_style)
                    t = Table([[p_eq]], colWidths=[500])
                    t.setStyle(
                        TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                ("PADDING", (0, 0), (-1, -1), 8),
                                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                            ]
                        )
                    )
                    story.append(t)
                story.append(Spacer(1, 8))

        elif b_type == "divider":
            t = Table([[""]], colWidths=[500])
            t.setStyle(
                TableStyle(
                    [
                        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 10))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_docx_bytes(journal: dict, student_name: str, classroom_name: str) -> bytes:
    """Generate professional Word Document (.docx) from block structure using python-docx."""
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor
    except ImportError:
        raise AppException(
            code=ErrorCode.EXPORT_FAILED,
            message="Export DOCX engine dependencies (python-docx) are currently compiling/downloading on the server. Please retry in 30 seconds.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    doc = Document()

    def set_cell_background(cell, fill_hex):
        from docx.oxml import parse_xml
        from docx.oxml.ns import nsdecls
        shading_xml = f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'
        cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

    def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
        from docx.oxml import parse_xml
        from docx.oxml.ns import nsdecls
        tcMar_xml = f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>'
        cell._tc.get_or_add_tcPr().append(parse_xml(tcMar_xml))

    # Page setup
    section = doc.sections[0]
    section.top_margin = Pt(54)
    section.bottom_margin = Pt(54)
    section.left_margin = Pt(54)
    section.right_margin = Pt(54)

    # Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run(journal.get("title", "Practical Lab Journal"))
    title_run.font.name = "Arial"
    title_run.font.size = Pt(24)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    title_p.space_after = Pt(12)

    # Metadata
    meta_p = doc.add_paragraph()
    date_str = (
        journal.get("updatedAt", "").split("T")[0]
        if isinstance(journal.get("updatedAt"), str)
        else "N/A"
    )
    meta_run = meta_p.add_run(
        f"Student Name: {student_name}\n"
        f"Classroom: {classroom_name}\n"
        f"Date: {date_str}"
    )
    meta_run.font.name = "Arial"
    meta_run.font.size = Pt(10)
    meta_run.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)
    meta_p.space_after = Pt(24)

    # Add divider line
    doc.add_paragraph("____________________________________________________").space_after = Pt(12)

    # Iterate blocks
    for block in journal.get("blocks", []):
        b_type = block.get("type")
        b_content = block.get("content", {})

        if b_type == "heading":
            lvl = b_content.get("level", 1)
            text = b_content.get("text", "")
            hp = doc.add_paragraph()
            hrun = hp.add_run(text)
            hrun.font.name = "Arial"
            hrun.font.bold = True
            hrun.font.size = Pt(16 if lvl == 1 else 13)
            hrun.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
            hp.space_before = Pt(12)
            hp.space_after = Pt(6)

        elif b_type == "paragraph":
            text = b_content.get("text", "")
            pp = doc.add_paragraph()
            prun = pp.add_run(text)
            prun.font.name = "Arial"
            prun.font.size = Pt(10.5)
            prun.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
            pp.space_after = Pt(8)

        elif b_type == "code":
            code = b_content.get("code", "")
            cp = doc.add_paragraph()
            crun = cp.add_run(code)
            crun.font.name = "Courier New"
            crun.font.size = Pt(9.5)
            crun.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
            cp.paragraph_format.left_indent = Pt(18)
            cp.space_after = Pt(8)

        elif b_type == "observation" or b_type == "result":
            title = "Observation" if b_type == "observation" else "Result"
            val = b_content.get("text", "")

            op = doc.add_paragraph()
            orun_t = op.add_run(f"[{title}]\n")
            orun_t.font.bold = True
            orun_t.font.size = Pt(10)
            if b_type == "observation":
                orun_t.font.color.rgb = RGBColor(0x1D, 0x4E, 0x89)
            else:
                orun_t.font.color.rgb = RGBColor(0x14, 0x53, 0x2D)

            orun_v = op.add_run(val)
            orun_v.font.size = Pt(10)
            orun_v.font.italic = True
            op.paragraph_format.left_indent = Pt(12)
            op.space_after = Pt(8)

        elif b_type == "table":
            headers = b_content.get("headers", [])
            rows = b_content.get("rows", [])
            if not headers:
                continue

            table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
            table.style = 'Table Grid'
            hdr_cells = table.rows[0].cells
            for idx, h in enumerate(headers):
                hdr_cells[idx].text = h
                set_cell_background(hdr_cells[idx], "F8FAFC")
                set_cell_margins(hdr_cells[idx], top=120, bottom=120, left=150, right=150)
                run = hdr_cells[idx].paragraphs[0].runs[0]
                run.font.name = "Arial"
                run.font.bold = True
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(0x11, 0x18, 0x27)

            for r_idx, r in enumerate(rows):
                row_cells = table.rows[r_idx + 1].cells
                bg_color = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
                for c_idx, h in enumerate(headers):
                    if isinstance(r, list):
                        val = r[c_idx] if c_idx < len(r) else ""
                    elif isinstance(r, dict):
                        val = r.get(h, "")
                    else:
                        val = ""
                    row_cells[c_idx].text = str(val)
                    set_cell_background(row_cells[c_idx], bg_color)
                    set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=150, right=150)
                    p = row_cells[c_idx].paragraphs[0]
                    if p.runs:
                        run = p.runs[0]
                        run.font.name = "Arial"
                        run.font.size = Pt(10)
                        run.font.color.rgb = RGBColor(0x37, 0x41, 0x51)

            doc.add_paragraph().space_after = Pt(8)

        elif b_type == "image":
            raw_images = b_content.get("images", [])
            main_caption = b_content.get("mainCaption", "") or b_content.get("caption", "")

            if not raw_images and b_content.get("url"):
                raw_images = [{"url": b_content.get("url"), "caption": b_content.get("caption", "")}]

            if raw_images:
                num_imgs = len(raw_images)
                max_w_per_img = 450.0 / min(num_imgs, 3)

                if num_imgs == 1:
                    # Single image layout
                    img_url = raw_images[0].get("url", "")
                    sub_cap = raw_images[0].get("caption", "") or main_caption
                    if img_url:
                        res = get_image_flowable_or_run(img_url, max_width=450, max_height=600)
                        if res:
                            _, img_stream, new_w, new_h = res
                            try:
                                doc.add_picture(img_stream, width=Pt(new_w), height=Pt(new_h))
                                if doc.paragraphs:
                                    doc.paragraphs[-1].alignment = 1
                                if sub_cap:
                                    cp = doc.add_paragraph()
                                    cp.alignment = 1
                                    crun = cp.add_run(sub_cap)
                                    crun.font.name = "Arial"
                                    crun.font.size = Pt(9.5)
                                    crun.font.italic = True
                                    crun.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)
                                    cp.space_after = Pt(8)
                            except Exception as e:
                                print(f"Failed to add image to docx: {e}")
                else:
                    # Multi-image side-by-side table layout in Word
                    try:
                        table = doc.add_table(rows=1, cols=num_imgs)
                        table.alignment = 1
                        for idx, img_info in enumerate(raw_images):
                            cell = table.rows[0].cells[idx]
                            img_url = img_info.get("url", "")
                            sub_cap = img_info.get("caption", "")
                            if img_url:
                                res = get_image_flowable_or_run(img_url, max_width=max_w_per_img - 10, max_height=300)
                                if res:
                                    _, img_stream, new_w, new_h = res
                                    cp = cell.paragraphs[0]
                                    cp.alignment = 1
                                    crun = cp.add_run()
                                    crun.add_picture(img_stream, width=Pt(new_w), height=Pt(new_h))
                                    if sub_cap:
                                        cap_p = cell.add_paragraph()
                                        cap_p.alignment = 1
                                        cap_run = cap_p.add_run(f"({chr(97 + idx)}) {sub_cap}")
                                        cap_run.font.name = "Arial"
                                        cap_run.font.size = Pt(8.5)
                                        cap_run.font.italic = True
                                        cap_run.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

                        if main_caption:
                            mcp = doc.add_paragraph()
                            mcp.alignment = 1
                            mcrun = mcp.add_run(main_caption)
                            mcrun.font.name = "Arial"
                            mcrun.font.size = Pt(9.5)
                            mcrun.font.bold = True
                            mcrun.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
                            mcp.space_after = Pt(8)
                    except Exception as e:
                        print(f"Failed to add multi-image gallery to docx: {e}")

        elif b_type == "page_break":
            doc.add_page_break()

        elif b_type == "reference":
            text = b_content.get("text", "")
            rp = doc.add_paragraph()
            rp.paragraph_format.left_indent = Pt(12)
            
            # Left border separator line
            rrun_border = rp.add_run("|  ")
            rrun_border.font.bold = True
            rrun_border.font.color.rgb = RGBColor(0xCB, 0xD5, 0xE1)
            
            rrun_icon = rp.add_run("🔖  ")
            
            rrun = rp.add_run(text)
            rrun.font.name = "Arial"
            rrun.font.size = Pt(9.5)
            rrun.font.italic = True
            rrun.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)
            rp.space_after = Pt(6)

        elif b_type == "equation":
            latex_str = b_content.get("latex", "")
            img_res = get_equation_image_flowable_or_run(latex_str, max_width=450, max_height=120)
            if img_res:
                _, img_stream, new_w, new_h = img_res
                try:
                    ep = doc.add_paragraph()
                    ep.alignment = 1 # Centered
                    erun = ep.add_run()
                    erun.add_picture(img_stream, width=Pt(new_w), height=Pt(new_h))
                    ep.space_before = Pt(8)
                    ep.space_after = Pt(8)
                except Exception as e:
                    print(f"Failed to add equation image to docx: {e}")
                    display_str = convert_latex_to_unicode(latex_str)
                    for eq_line in display_str.split("\n"):
                        ep = doc.add_paragraph()
                        ep.alignment = 1
                        erun = ep.add_run(eq_line)
                        erun.font.name = "Cambria Math"
                        erun.font.size = Pt(12)
                        erun.font.italic = True
                        erun.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
                        ep.space_before = Pt(4)
                        ep.space_after = Pt(4)
            else:
                display_str = convert_latex_to_unicode(latex_str)
                for eq_line in display_str.split("\n"):
                    ep = doc.add_paragraph()
                    ep.alignment = 1
                    erun = ep.add_run(eq_line)
                    erun.font.name = "Cambria Math"
                    erun.font.size = Pt(12)
                    erun.font.italic = True
                    erun.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
                    ep.space_before = Pt(4)
                    ep.space_after = Pt(4)

        elif b_type == "divider":
            doc.add_paragraph("------------------------------------------------").space_after = Pt(8)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
