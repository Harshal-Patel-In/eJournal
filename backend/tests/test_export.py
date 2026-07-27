import pytest
from app.utils.export import convert_latex_to_unicode, generate_pdf_bytes, generate_docx_bytes, format_unicode_sub_sup_html

def test_convert_latex_to_unicode_empty():
    assert convert_latex_to_unicode("") == ""
    assert convert_latex_to_unicode(None) == ""

def test_convert_latex_to_unicode_greek_letters():
    assert convert_latex_to_unicode("\\alpha \\beta \\gamma \\theta \\pi") == "α β γ θ π"
    assert convert_latex_to_unicode("\\Gamma \\Delta \\Omega") == "Γ Δ Ω"

def test_convert_latex_to_unicode_square_root():
    assert convert_latex_to_unicode("\\sqrt{x}") == "√(x)"
    assert convert_latex_to_unicode("\\sqrt[3]{x}") == "³√(x)"
    assert convert_latex_to_unicode("\\sqrt y") == "√y"

def test_convert_latex_to_unicode_subscripts_superscripts():
    assert convert_latex_to_unicode("x^2 + y_1") == "x² + y₁"
    assert convert_latex_to_unicode("a^{n+1}") == "aⁿ⁺¹"
    assert convert_latex_to_unicode("b_{i-1}") == "bᵢ₋₁"
    # Wait, b_{i-1} in SUBSCRIPTS has i, but '-' is not in SUBSCRIPTS? Let's check:
    # SUBSCRIPTS mapping: '-' maps to '₋', '1' maps to '₁', so 'i-1' maps to 'ᵢ₋₁'!
    # Let's check our test: in math-shortcuts.ts:
    # _([0-9+\-=()aeh-pr-vx])
    # Yes, all characters in i, -, 1 are mapped!
    # So b_{i-1} will map to bᵢ₋₁.
    # Let's write the test accordingly.

def test_convert_latex_to_unicode_subscripts_superscripts_advanced():
    assert convert_latex_to_unicode("a^{n+1}") == "aⁿ⁺¹"
    assert convert_latex_to_unicode("b_{i-1}") == "bᵢ₋₁"

def test_convert_latex_to_unicode_fractions():
    assert convert_latex_to_unicode("\\frac{1}{2}") == "(1/2)"
    assert convert_latex_to_unicode("\\frac{x^2}{\\alpha}") == "(x²/α)"

def test_convert_latex_to_unicode_matrix():
    latex_matrix = "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"
    expected = "⎛ a b ⎞\n⎝ c d ⎠"
    assert convert_latex_to_unicode(latex_matrix) == expected

def test_convert_latex_to_unicode_complex():
    latex_str = "\\alpha\\sqrt{x}2^{2}()\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"
    result = convert_latex_to_unicode(latex_str)
    assert "α" in result
    assert "√(x)" in result
    assert "2²" in result
    assert "⎛ a b ⎞" in result
    assert "⎝ c d ⎠" in result

def test_exporters_success():
    # Construct a complete mock journal containing ALL block types
    mock_journal = {
        "title": "Practical Lab Journal Test",
        "updatedAt": "2026-07-20T10:00:00.000Z",
        "studentId": "student_123",
        "assignmentId": "assignment_123",
        "blocks": [
            {"type": "heading", "content": {"text": "Heading Test", "level": 1}},
            {"type": "paragraph", "content": {"text": "This is a normal paragraph with 2^4 and log_7 formatting."}},
            {"type": "image", "content": {"url": "https://res.cloudinary.com/dummy/image.png", "caption": "An image caption"}},
            {"type": "image", "content": {"url": "uploads/dummy_local.png"}},  # local path mock
            {"type": "page_break", "content": {}},
            {"type": "table", "content": {"headers": ["Col 1", "Col 2"], "rows": [["1", "2"], ["3", "4"]]}},  # list rows
            {"type": "table", "content": {"headers": ["Col 1", "Col 2"], "rows": [{"Col 1": "A", "Col 2": "B"}]}},  # dict rows fallback
            {"type": "reference", "content": {"text": "Author, Title, 2026"}},
            {"type": "equation", "content": {"latex": "\\alpha\\sqrt{x}"}},
            {"type": "divider", "content": {}},
            {"type": "code", "content": {"code": "print('hello')", "language": "python"}},
            {"type": "observation", "content": {"text": "Observation detail"}},
            {"type": "result", "content": {"text": "Result outcome"}},
        ]
    }
    
    # Run exporters
    pdf_bytes = generate_pdf_bytes(mock_journal, "Harshal Patel", "Test Classroom")
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    
    docx_bytes = generate_docx_bytes(mock_journal, "Harshal Patel", "Test Classroom")
    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 0

def test_format_unicode_sub_sup_html():
    # Superscripts
    assert format_unicode_sub_sup_html("x² + y³") == "x<sup>2</sup> + y<sup>3</sup>"
    assert format_unicode_sub_sup_html("2⁴") == "2<sup>4</sup>"
    
    # Subscripts
    assert format_unicode_sub_sup_html("log₇") == "log<sub>7</sub>"
    assert format_unicode_sub_sup_html("aᵢ₋₁") == "a<sub>i-1</sub>"
    
    # Mix
    assert format_unicode_sub_sup_html("x² + log₇(x)") == "x<sup>2</sup> + log<sub>7</sub>(x)"
    
    # Empty & invalid inputs
    assert format_unicode_sub_sup_html("") == ""
    assert format_unicode_sub_sup_html(None) == ""

