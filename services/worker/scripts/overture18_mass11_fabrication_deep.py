"""NET-IT-MASS11: deeper Overture wave for welding / fabrication / sheet metal.

Read-only discovery only. Overture taxonomy and websites are discovery hints;
first-party AUTO2/AUTO3 verification remains mandatory before publication.
"""
from __future__ import annotations
import csv, json
from pathlib import Path
import duckdb
import overture4_national_next as source

LICENSE="CDLA-Permissive-2.0"
RELEASE="2026-10-21.0"
assert source.RELEASE==RELEASE

AREAS={
 "calabria_cosenza":(15.45,17.35,38.95,40.25),
 "calabria_catanzaro_vibo":(15.55,17.45,38.15,39.20),
 "calabria_reggio":(15.35,16.85,37.75,38.55),
 "basilicata_potenza_matera":(15.15,17.25,39.65,41.30),
 "puglia_foggia_bat":(14.85,16.95,40.65,42.20),
 "puglia_taranto_lecce_brindisi":(16.15,18.65,39.55,41.35),
 "campania_caserta_napoli":(13.55,15.25,40.45,41.65),
 "campania_salerno_avellino_benevento":(14.15,15.95,39.85,41.55),
 "sicilia_palermo_trapani_agrigento":(12.10,14.20,36.55,38.45),
 "sicilia_catania_siracusa_ragusa":(13.75,15.55,36.45,38.30),
 "sardegna_nord":(7.85,9.95,39.95,41.55),
 "sardegna_sud":(8.05,9.95,38.75,40.35),
 "molise":(13.65,15.25,41.25,42.25),
 "abruzzo_pescara_chieti":(13.75,14.95,41.65,42.70),
 "abruzzo_laquila_teramo":(13.05,14.55,41.85,42.95),
 "marche_ancona_pesaro":(12.30,13.85,43.15,44.25),
 "marche_macerata_ascoli":(12.55,13.95,42.45,43.60),
 "umbria_perugia_terni":(11.75,13.45,42.25,43.70),
 "liguria_genova_savona":(7.95,9.45,43.75,44.75),
 "liguria_la_spezia":(9.25,10.10,43.75,44.55),
 "toscana_firenze_prato_pistoia":(10.45,11.65,43.35,44.25),
 "lazio_viterbo_rieti":(11.35,13.55,41.45,42.95),
 "lazio_latina_frosinone":(12.20,14.05,40.75,42.05),
 "emilia_parma_piacenza_reggio":(9.00,11.10,44.25,45.25),
 "emilia_bologna_modena_ferrara":(10.45,12.45,44.00,45.15),
 "veneto_vicenza_verona_rovigo":(10.55,12.20,44.65,46.25),
 "lombardia_milano_monza_varese_como":(8.25,9.65,45.20,46.25),
 "piemonte_torino_nord_est":(7.35,8.45,44.95,45.70),
 "piemonte_cuneo_langhe":(6.75,8.25,43.95,45.10),
}
# Continue beyond MASS7's last sampled windows.
OFFSETS={
 "calabria_cosenza":260,"calabria_catanzaro_vibo":260,"calabria_reggio":260,
 "basilicata_potenza_matera":260,"puglia_foggia_bat":260,
 "puglia_taranto_lecce_brindisi":260,"campania_caserta_napoli":260,
 "campania_salerno_avellino_benevento":260,
 "sicilia_palermo_trapani_agrigento":480,
 "sicilia_catania_siracusa_ragusa":480,
 "sardegna_nord":260,"sardegna_sud":260,"molise":260,
 "abruzzo_pescara_chieti":260,"abruzzo_laquila_teramo":260,
 "marche_ancona_pesaro":260,"marche_macerata_ascoli":260,
 "umbria_perugia_terni":480,
 "liguria_genova_savona":260,"liguria_la_spezia":260,
 "toscana_firenze_prato_pistoia":700,
 "lazio_viterbo_rieti":480,"lazio_latina_frosinone":480,
 "emilia_parma_piacenza_reggio":700,
 "emilia_bologna_modena_ferrara":920,
 "veneto_vicenza_verona_rovigo":1360,
 "lombardia_milano_monza_varese_como":1240,
 "piemonte_torino_nord_est":260,"piemonte_cuneo_langhe":260,
}
CATEGORIES=(
 "metal_fabricator","sheet_metal_fabricator","steel_fabricators",
 "metal_fabrication","welding_service","iron_works",
 "metalworking_shop","metal_workshop",
)

def main():
    source.AREAS=AREAS
    source.RAW_OFFSET=OFFSETS
    source.CATEGORY=CATEGORIES
    source.RAW_LIMIT=1800
    source.PER_AREA=260
    source.LICENSES=frozenset({LICENSE})
    source.REJECT_HOSTS=source.REJECT_HOSTS|frozenset({
      "weebly.com","jimdo.com","jimdosite.com","wixsite.com","blogspot.com",
      "wordpress.com","sites.google.com","site123.me","business.site",
      "facebook.com","instagram.com","linkedin.com","youtube.com","wa.me",
      "godaddysites.com","infoisinfo.it","reteimprese.it","autoline.info",
      "simdif.com","altervista.org","webnode.it",
    })
    db=duckdb.connect(config={"threads":2,"memory_limit":"768MB"})
    db.execute("INSTALL httpfs"); db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'"); db.execute("SET http_timeout=60000")
    groups=[source.collect(db,k,v) for k,v in AREAS.items()]
    domains={}
    for g in groups:
        for i in g["selected"]:
            if i["licenses"]==[LICENSE]:
                domains.setdefault(i["domain"],i)
    audit=Path(__file__).resolve().parents[1]/"audits/net_it_mass11_20261120_gers.csv"
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open("w",encoding="utf-8",newline="") as fp:
        w=csv.writer(fp)
        w.writerow(("domain","gers_id","search_bucket","overture_taxonomy","source_license","release"))
        for d in sorted(domains):
            i=domains[d]
            w.writerow((d,i["gers"],i["region_bucket"],i["category"],LICENSE,RELEASE))
    print("MASS11_RESULT="+json.dumps({
      "release":RELEASE,"license":LICENSE,"read_only":True,
      "selected_distinct_domains":len(domains),
      "areas":[{"bucket":g["area"],"raw":g["raw_records"],
                "licensed_distinct":g["distinct_licensed"],
                "selected":len(g["selected"])} for g in groups],
      "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1]))
    },separators=(",",":")))

if __name__=="__main__": main()
