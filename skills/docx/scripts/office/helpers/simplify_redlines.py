"""Simplify tracked changes by merging adjacent revisions from same author."""

import zipfile
from pathlib import Path

import defusedxml.minidom


def simplify_redlines(input_dir: str) -> tuple[int, str]:
    doc_xml = Path(input_dir) / "word" / "document.xml"

    if not doc_xml.exists():
        return 0, f"Error: {doc_xml} not found"

    try:
        dom = defusedxml.minidom.parseString(doc_xml.read_text(encoding="utf-8"))
        root = dom.documentElement

        merge_count = 0
        for container in _find_paragraph_containers(root):
            for tag in ["ins", "del"]:
                merge_count += _merge_tracked_changes_in(container, tag)

        doc_xml.write_bytes(dom.toxml(encoding="UTF-8"))
        return merge_count, f"Simplified {merge_count} tracked changes"
    except Exception as e:
        return 0, f"Error: {e}"


def _find_paragraph_containers(root) -> set:
    containers = set()
    for p in _find_elements(root, "p"):
        containers.add(p)
    return containers


def _find_elements(root, tag: str) -> list:
    results = []

    def traverse(node):
        if node.nodeType == node.ELEMENT_NODE:
            name = node.localName or node.tagName
            if name == tag or name.endswith(f":{tag}"):
                results.append(node)
            for child in node.childNodes:
                traverse(child)

    traverse(root)
    return results


def _merge_tracked_changes_in(container, tag: str) -> int:
    merge_count = 0
    children = list(container.childNodes)
    elements = [
        c for c in children
        if c.nodeType == c.ELEMENT_NODE and (
            c.localName == tag or
            c.tagName == tag or
            c.tagName.endswith(f":{tag}")
        )
    ]

    i = 0
    while i < len(elements) - 1:
        elem1 = elements[i]
        elem2 = elements[i + 1]
        if _can_merge_tracked(elem1, elem2):
            _merge_tracked_content(elem1, elem2)
            if elem2.parentNode:
                elem2.parentNode.removeChild(elem2)
            elements.pop(i + 1)
            merge_count += 1
        else:
            i += 1

    return merge_count


def _can_merge_tracked(elem1, elem2) -> bool:
    author1 = elem1.getAttribute("w:author")
    author2 = elem2.getAttribute("w:author")
    if author1 != author2:
        return False

    node = elem1.nextSibling
    while node and node != elem2:
        if node.nodeType == node.ELEMENT_NODE:
            return False
        if node.nodeType == node.TEXT_NODE and node.data.strip():
            return False
        node = node.nextSibling
    return True


def _merge_tracked_content(target, source):
    for child in list(source.childNodes):
        target.appendChild(child)


def get_tracked_change_authors(doc_xml_path: str) -> dict:
    path = Path(doc_xml_path)
    if not path.exists():
        return {}

    dom = defusedxml.minidom.parseString(path.read_text(encoding="utf-8"))
    authors: dict = {}
    for tag in ["ins", "del"]:
        for elem in _find_elements(dom.documentElement, tag):
            author = elem.getAttribute("w:author")
            if author:
                authors[author] = authors.get(author, 0) + 1
    return authors


def _get_authors_from_docx(docx_path: str) -> dict:
    try:
        with zipfile.ZipFile(docx_path, "r") as zf:
            if "word/document.xml" in zf.namelist():
                content = zf.read("word/document.xml").decode("utf-8")
                dom = defusedxml.minidom.parseString(content)
                authors: dict = {}
                for tag in ["ins", "del"]:
                    for elem in _find_elements(dom.documentElement, tag):
                        author = elem.getAttribute("w:author")
                        if author:
                            authors[author] = authors.get(author, 0) + 1
                return authors
    except Exception:
        pass
    return {}


def infer_author(modified_dir: str, original_docx: str, default: str = "Claude") -> str:
    original_authors = _get_authors_from_docx(original_docx)
    modified_authors = get_tracked_change_authors(
        str(Path(modified_dir) / "word" / "document.xml")
    )

    for author, count in modified_authors.items():
        if count > original_authors.get(author, 0):
            return author
    return default
