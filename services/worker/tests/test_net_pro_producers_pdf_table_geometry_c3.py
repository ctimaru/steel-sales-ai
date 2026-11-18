"""C3 geometric table candidate extraction: no false cross-column sizes."""
from app.net_pro_producers_pdf_table_geometry_c3 import extract_positioned_thickness


def fixture(*, weight_x=80, suffix=None):
    def r(y, *tokens):
        return [{"x":x,"y":y,"size":10,"text":text} for x,text in tokens]
    spans = (
        r(700,(10,"RECTANGULAR EN 10219 - theoretical weight kg/m"))
        + r(680,(50,"Thickness"))
        + r(667,(80,"5"),(120,"6"),(160,"8"))
        + r(650,(10,"200"),(35,"100"),(weight_x,"22,3"),(120,"26,4"))
    )
    if suffix:
        spans += suffix
    size = [{"page":1,"shape":"RHS","standard":"EN 10219","width_mm":200.,
             "height_mm":100.,"locator":"pdf_page:1:table:rhs_en10219:row:200x100"}]
    return [{"page":1,"spans":spans}],size


def test_exact_columns_produce_only_observed_slots():
    pages,sizes=fixture()
    result=extract_positioned_thickness(pages,sizes)
    rows=result["candidate_rows"]
    assert len(rows)==2
    assert [x["thickness_mm"] for x in rows]==[5.,6.]
    assert all(x["standard"]=="EN 10219" and x["shape"]=="RHS" for x in rows)
    assert all(x["source_locator"]==sizes[0]["locator"] for x in rows)
    assert all(len(x["geometry_sha256"])==64 for x in rows)
    assert result["source_verified"]==result["manufacturer_confirmed"]==0


def test_misaligned_weight_does_not_claim_thickness():
    pages,sizes=fixture(weight_x=93)
    rows=extract_positioned_thickness(pages,sizes)["candidate_rows"]
    assert len(rows)==1
    assert rows[0]["thickness_mm"]==6.


def test_no_source_row_means_no_thickness():
    pages,_=fixture()
    assert extract_positioned_thickness(pages,[])["candidate_rows"]==[]


def test_collision_in_source_row_suppresses_ambiguous_mapping():
    pages,sizes=fixture()
    result=extract_positioned_thickness(pages,sizes+sizes)
    assert result["candidate_rows"]==[]
    assert result["ambiguous_rows"]==1


def test_flattened_multi_value_span_is_not_fabricated_into_columns():
    pages,sizes=fixture()
    pages[0]["spans"]=[x for x in pages[0]["spans"]
                        if x["y"]!=650]+[
        {"x":10,"y":650,"size":10,"text":"200 100 22,3 26,4"}]
    assert extract_positioned_thickness(pages,sizes)["candidate_rows"]==[]
