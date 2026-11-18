-- NET-PRODUCERS: scale beyond one tube catalogue with documented,
-- individually indexed numeric external dimensions, not copied PDF pages.
-- The source index exposes first-column dimensions but NOT thickness alignment.
-- CSM/Padana standard is intentionally UNSPECIFIED (do not borrow adjacent text).
alter table private.network_producer_pdf_size_rows
  drop constraint network_producer_pdf_size_rows_standard_check;
alter table private.network_producer_pdf_size_rows
  add constraint network_producer_pdf_size_rows_standard_check
  check(standard in ('EN 10219','EN 10210','CATALOGUE_UNSPECIFIED'));

-- 101 NEW observations: 29 Acciaitubi, 42 Padana, 30 CSM.
-- Sha is a fingerprint of the literal PDF text-index line, not a hash of
-- copyrighted PDF bytes. Factual dimensions only; no grade or wall thickness.
with observed(company_id,source_url,page,standard,shape,width_mm,height_mm,diameter_mm,locator,source_line) as (
 values
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,21.3,'pdf_page:27:table:chs_en10219:row:21-3','21,3'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,22,'pdf_page:27:table:chs_en10219:row:22-0','22,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,25,'pdf_page:27:table:chs_en10219:row:25-0','25,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,26,'pdf_page:27:table:chs_en10219:row:26-0','26,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,26.9,'pdf_page:27:table:chs_en10219:row:26-9','26,9'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,27,'pdf_page:27:table:chs_en10219:row:27-0','27,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,28,'pdf_page:27:table:chs_en10219:row:28-0','28,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,30,'pdf_page:27:table:chs_en10219:row:30-0','30,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,32,'pdf_page:27:table:chs_en10219:row:32-0','32,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,33.7,'pdf_page:27:table:chs_en10219:row:33-7','33,7'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,35,'pdf_page:27:table:chs_en10219:row:35-0','35,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,38,'pdf_page:27:table:chs_en10219:row:38-0','38,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,40,'pdf_page:27:table:chs_en10219:row:40-0','40,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,41.3,'pdf_page:27:table:chs_en10219:row:41-3','41,3'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,41.5,'pdf_page:27:table:chs_en10219:row:41-5','41,5'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,42,'pdf_page:27:table:chs_en10219:row:42-0','42,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,42.4,'pdf_page:27:table:chs_en10219:row:42-4','42,4'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,45,'pdf_page:27:table:chs_en10219:row:45-0','45,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,48,'pdf_page:27:table:chs_en10219:row:48-0','48,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,48.3,'pdf_page:27:table:chs_en10219:row:48-3','48,3'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,50,'pdf_page:27:table:chs_en10219:row:50-0','50,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,51,'pdf_page:27:table:chs_en10219:row:51-0','51,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,60,'pdf_page:27:table:chs_en10219:row:60-0','60,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,60.3,'pdf_page:27:table:chs_en10219:row:60-3','60,3'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,63.5,'pdf_page:27:table:chs_en10219:row:63-5','63,5'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,76.1,'pdf_page:27:table:chs_en10219:row:76-1','76,1'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,88.9,'pdf_page:27:table:chs_en10219:row:88-9','88,9'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,108,'pdf_page:27:table:chs_en10219:row:108-0','108,0'),
  ('51100000-0000-5000-8000-000000000001','https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',27,'EN 10219','CHS',NULL,NULL,114.3,'pdf_page:27:table:chs_en10219:row:114-3','114,3'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,63.5,'pdf_page:7:table:chs_catalogue:row:63-5','63,5 1,872 2,329 3,080 4,545 5,960'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,70,'pdf_page:7:table:chs_catalogue:row:70','70 2,573 3,405 4,226 5,033 6,611'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,76.1,'pdf_page:7:table:chs_catalogue:row:76-1','76,1 2”1/2 2,251 2,802 2,985 3,711 4,607 4,785 5,491 7,222'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,88.9,'pdf_page:7:table:chs_catalogue:row:88-9','88,9 3” 3,283 3,498 4,352 5,409 5,618 6,453 8,504 10,504'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,101.6,'pdf_page:7:table:chs_catalogue:row:101-6','101,6 3”1/2 3,760 4,988 6,204 7,407 9,776 12,094'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,108,'pdf_page:7:table:chs_catalogue:row:108','108 4,001 5,309 6,605 7,888 10,420'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,114.3,'pdf_page:7:table:chs_catalogue:row:114-3','114,3 4” 4,237 4,515 5,624 6,999 7,272 8,361 11,048 13,684'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,139.7,'pdf_page:7:table:chs_catalogue:row:139-7','139,7 5” 5,191 6,896 9,484 10,269 13,592 16,864'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,168.3,'pdf_page:7:table:chs_catalogue:row:168-3','168,3 6” 6,265 8,328 10,379 12,417 16,456 20,445'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,219.1,'pdf_page:7:table:chs_catalogue:row:219-1','219,1 8” 10,872 14,089 16,233 21,544 26,805 32,016'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,273,'pdf_page:7:table:chs_catalogue:row:273','273 10” 13,572 20,282 26,943 33,554 40,114'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,323.9,'pdf_page:7:table:chs_catalogue:row:323-9','323,9 12” 16,091 24,061 31,981 39,851 47,671'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',10,10,NULL,'pdf_page:7:table:shs_catalogue:row:10x10','10x10 0,294'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',12,12,NULL,'pdf_page:7:table:shs_catalogue:row:12x12','12x12 0,358 0,423 0,518'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',15,15,NULL,'pdf_page:7:table:shs_catalogue:row:15x15','15x15 0,453 0,538 0,661 0,857'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',20,20,NULL,'pdf_page:7:table:shs_catalogue:row:20x20','20x20 0,613 0,729 0,901 1,175'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',25,25,NULL,'pdf_page:7:table:shs_catalogue:row:25x25','25x25 0,772 0,921 1,140 1,494 1,837 2,167'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',30,30,NULL,'pdf_page:7:table:shs_catalogue:row:30x30','30x30 0,932 1,112 1,379 1,814 2,236 2,645'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',35,35,NULL,'pdf_page:7:table:shs_catalogue:row:35x35','35x35 1,091 1,303 1,618 2,132 2,635 3,124'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',40,40,NULL,'pdf_page:7:table:shs_catalogue:row:40x40','40x40 1,251 1,495 1,857 2,451 3,033 3,602 4,703'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',50,50,NULL,'pdf_page:7:table:shs_catalogue:row:50x50','50x50 1,878 2,336 3,089 3,831 4,559 5,979 7,349'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',60,60,NULL,'pdf_page:7:table:shs_catalogue:row:60x60','60x60 2,814 3,727 4,628 5,516 7,255 8,943'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',80,80,NULL,'pdf_page:7:table:shs_catalogue:row:80x80','80x80 5,003 6,223 7,430 9,807 12,133'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',100,100,NULL,'pdf_page:7:table:shs_catalogue:row:100x100','100x100 6,279 9,343 12,358 15,322'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',150,150,NULL,'pdf_page:7:table:shs_catalogue:row:150x150','150x150 9,469 14,129 18,738 23,298 27,807'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','SHS',200,200,NULL,'pdf_page:7:table:shs_catalogue:row:200x200','200x200 12,659 18,913 25,118 31,272 37,376'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',20,10,NULL,'pdf_page:7:table:rhs_catalogue:row:20x10','20x10 0,453 0,538 0,661'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',20,15,NULL,'pdf_page:7:table:rhs_catalogue:row:20x15','20x15 0,533 0,634 0,781 1,016'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',25,15,NULL,'pdf_page:7:table:rhs_catalogue:row:25x15','25x15 0,613 0,729 0,900 1,176'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',30,20,NULL,'pdf_page:7:table:rhs_catalogue:row:30x20','30x20 0,772 0,921 1,140 1,494'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',40,20,NULL,'pdf_page:7:table:rhs_catalogue:row:40x20','40x20 0,932 1,112 1,379 1,813 2,465'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',40,30,NULL,'pdf_page:7:table:rhs_catalogue:row:40x30','40x30 1,091 1,303 1,618 2,132 2,635 3,124'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',50,20,NULL,'pdf_page:7:table:rhs_catalogue:row:50x20','50x20 1,091 1,303 1,618 2,132'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',50,40,NULL,'pdf_page:7:table:rhs_catalogue:row:50x40','50x40 1,686 2,097 2,770 3,432 4,081'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',60,30,NULL,'pdf_page:7:table:rhs_catalogue:row:60x30','60x30 1,686 2,097 2,770 3,432 4,081'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',60,40,NULL,'pdf_page:7:table:rhs_catalogue:row:60x40','60x40 1,878 2,336 3,089 3,831 4,559 5,979'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',80,40,NULL,'pdf_page:7:table:rhs_catalogue:row:80x40','80x40 2,261 2,814 3,727 4,628 5,516 7,255 8,943'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',80,60,NULL,'pdf_page:7:table:rhs_catalogue:row:80x60','80x60 4,365 5,426 6,473 8,531 10,538'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',100,60,NULL,'pdf_page:7:table:rhs_catalogue:row:100x60','100x60 5,003 7,430 9,807 12,133'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',120,80,NULL,'pdf_page:7:table:rhs_catalogue:row:120x80','120x80 6,279 9,343 12,358 15,322'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',150,100,NULL,'pdf_page:7:table:rhs_catalogue:row:150x100','150x100 7,874 11,735 15,548 19,310 23,022'),
  ('51100000-0000-5000-8000-000000000003','https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',7,'CATALOGUE_UNSPECIFIED','RHS',200,100,NULL,'pdf_page:7:table:rhs_catalogue:row:200x100','200x100 9,469 14,129 18,738 23,298 27,807'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,15,'pdf_page:5:table:chs_catalogue:row:15-00','15,00 0.591'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,15.5,'pdf_page:5:table:chs_catalogue:row:15-50','15,50 0.610'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,15.7,'pdf_page:5:table:chs_catalogue:row:15-70','15,70 0.618'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,15.88,'pdf_page:5:table:chs_catalogue:row:15-88','15,88 5/8”'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,16,'pdf_page:5:table:chs_catalogue:row:16-00','16,00 0.630'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,17,'pdf_page:5:table:chs_catalogue:row:17-00','17,00 0.669'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,17.4,'pdf_page:5:table:chs_catalogue:row:17-40','17,40 0.685'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,18,'pdf_page:5:table:chs_catalogue:row:18-00','18,00 0.709'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,19,'pdf_page:5:table:chs_catalogue:row:19-00','19,00 0.748'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,19.05,'pdf_page:5:table:chs_catalogue:row:19-05','19,05 3/4”'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,19.3,'pdf_page:5:table:chs_catalogue:row:19-30','19,30 0.760'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,19.5,'pdf_page:5:table:chs_catalogue:row:19-50','19,50 0.767'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,19.7,'pdf_page:5:table:chs_catalogue:row:19-70','19,70 0.776'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,20,'pdf_page:5:table:chs_catalogue:row:20-00','20,00 0.787'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,21,'pdf_page:5:table:chs_catalogue:row:21-00','21,00 0.827'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,21.3,'pdf_page:5:table:chs_catalogue:row:21-30','21,30 0.839'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,21.6,'pdf_page:5:table:chs_catalogue:row:21-60','21,60 0.850'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,22,'pdf_page:5:table:chs_catalogue:row:22-00','22,00 0.866'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,22.22,'pdf_page:5:table:chs_catalogue:row:22-22','22,22 7/8”'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,23,'pdf_page:5:table:chs_catalogue:row:23-00','23,00 0.906'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,24,'pdf_page:5:table:chs_catalogue:row:24-00','24,00 0.945'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,25,'pdf_page:5:table:chs_catalogue:row:25-00','25,00 0.984'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,25.4,'pdf_page:5:table:chs_catalogue:row:25-40','25,40 1”'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,26,'pdf_page:5:table:chs_catalogue:row:26-00','26,00 1.024'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,26.9,'pdf_page:5:table:chs_catalogue:row:26-90','26,90 1.059'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,27,'pdf_page:5:table:chs_catalogue:row:27-00','27,00 1.063'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,28,'pdf_page:5:table:chs_catalogue:row:28-00','28,00 1.102'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,30,'pdf_page:5:table:chs_catalogue:row:30-00','30,00 1.181'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,31.75,'pdf_page:5:table:chs_catalogue:row:31-75','31,75 1-1/4”'),
  ('52917e21-7beb-4e50-83a9-b80cfd71d4ea','https://www.csmtube.com/wp-content/uploads/2025/12/CSM-TUBE_EN_Brochure.pdf',5,'CATALOGUE_UNSPECIFIED','CHS',NULL,NULL,32,'pdf_page:5:table:chs_catalogue:row:32-00','32,00 1.260')
), safe_source as (
select o.* from observed o
join public.network_companies c on c.id=o.company_id::uuid
join private.network_producer_catalog_links l
  on l.company_id=o.company_id::uuid and l.source_url=o.source_url
join public.network_company_role_assignments a on a.company_id=c.id
join public.network_company_roles r on r.id=a.role_id
where c.publication_status='published' and c.archived_at is null
and c.country_code='IT' and r.canonical_key='producer' and r.status='active'
and l.document_type='official_pdf' and l.source_status='official_link_observed'
and l.rights_status='link_only'
and (
 regexp_replace(lower(split_part(o.source_url,'/',3)),'^www[.]','')
 =regexp_replace(lower(c.website_domain),'^www[.]','')
 or right(regexp_replace(lower(split_part(o.source_url,'/',3)),'^www[.]',''),
 length(regexp_replace(lower(c.website_domain),'^www[.]',''))+1)
 ='.'||regexp_replace(lower(c.website_domain),'^www[.]','')
)
), inserted as (
 insert into private.network_producer_pdf_size_rows(
  company_id,source_url,page,standard,shape,width_mm,height_mm,
  diameter_mm,locator,line_sha256,extraction_basis)
 select company_id::uuid,source_url,page,standard,shape,width_mm,height_mm,
  diameter_mm,locator,
  encode(sha256(convert_to(source_line,'UTF8')),'hex'),
  'official_pdf_text_index'
 from safe_source
 where true
 on conflict(company_id,source_url,locator) do nothing
 returning id,company_id
)
insert into private.network_producer_pdf_row_events(row_id,company_id,event)
select id,company_id,'observed' from inserted;
