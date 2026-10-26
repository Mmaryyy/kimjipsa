-- P6: INV-01~10, INV-13~16, ACC-13. Derived inventory states are never stored.
-- DEC-014: validate decorative icons at the table and RPC boundary.
create function private.inventory_icon_valid(kind text, value text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  current_character text;
  current_kind text;
  previous_kind text;
  code integer;
  regional_count integer := 0;
  emoji_prefix boolean := false;
  joined_emoji boolean := false;
  conjunct_start boolean := false;
  conjunct_link boolean := false;
  has_visible boolean := false;
  -- Unicode 17.0 properties, encoded as ranges for PostgreSQL's regex engine.
  emoji text := (U&'[\00A9\00AE\203C\2049\2122\2139\2194-\2199\21A9-\21AA\231A-\231B\2328' ||
    U&'\23CF\23E9-\23F3\23F8-\23FA\24C2\25AA-\25AB\25B6\25C0\25FB-\25FE' ||
    U&'\2600-\2604\260E\2611\2614-\2615\2618\261D\2620\2622-\2623\2626\262A' ||
    U&'\262E-\262F\2638-\263A\2640\2642\2648-\2653\265F-\2660\2663' ||
    U&'\2665-\2666\2668\267B\267E-\267F\2692-\2697\2699\269B-\269C' ||
    U&'\26A0-\26A1\26A7\26AA-\26AB\26B0-\26B1\26BD-\26BE\26C4-\26C5\26C8' ||
    U&'\26CE-\26CF\26D1\26D3-\26D4\26E9-\26EA\26F0-\26F5\26F7-\26FA\26FD' ||
    U&'\2702\2705\2708-\270D\270F\2712\2714\2716\271D\2721\2728\2733-\2734' ||
    U&'\2744\2747\274C\274E\2753-\2755\2757\2763-\2764\2795-\2797\27A1\27B0' ||
    U&'\27BF\2934-\2935\2B05-\2B07\2B1B-\2B1C\2B50\2B55\3030\303D\3297\3299' ||
    U&'\+01F004\+01F02C-\+01F02F\+01F094-\+01F09F\+01F0AF-\+01F0B0\+01F0C0' ||
    U&'\+01F0CF-\+01F0D0\+01F0F6-\+01F0FF\+01F170-\+01F171\+01F17E-\+01F17F' ||
    U&'\+01F18E\+01F191-\+01F19A\+01F1AF-\+01F1E5\+01F201-\+01F20F\+01F21A' ||
    U&'\+01F22F\+01F232-\+01F23A\+01F23C-\+01F23F\+01F249-\+01F25F' ||
    U&'\+01F266-\+01F321\+01F324-\+01F393\+01F396-\+01F397\+01F399-\+01F39B' ||
    U&'\+01F39E-\+01F3F0\+01F3F3-\+01F3F5\+01F3F7-\+01F3FA\+01F400-\+01F4FD' ||
    U&'\+01F4FF-\+01F53D\+01F549-\+01F54E\+01F550-\+01F567\+01F56F-\+01F570' ||
    U&'\+01F573-\+01F57A\+01F587\+01F58A-\+01F58D\+01F590\+01F595-\+01F596' ||
    U&'\+01F5A4-\+01F5A5\+01F5A8\+01F5B1-\+01F5B2\+01F5BC\+01F5C2-\+01F5C4' ||
    U&'\+01F5D1-\+01F5D3\+01F5DC-\+01F5DE\+01F5E1\+01F5E3\+01F5E8\+01F5EF' ||
    U&'\+01F5F3\+01F5FA-\+01F64F\+01F680-\+01F6C5\+01F6CB-\+01F6D2' ||
    U&'\+01F6D5-\+01F6E5\+01F6E9\+01F6EB-\+01F6F0\+01F6F3-\+01F6FF' ||
    U&'\+01F7DC-\+01F7F0\+01F80C-\+01F80F\+01F848-\+01F84F\+01F85A-\+01F85F' ||
    U&'\+01F888-\+01F88F\+01F8AE-\+01F8AF\+01F8BC-\+01F8BF\+01F8C2-\+01F8CF' ||
    U&'\+01F8D9-\+01F8FF\+01F90C-\+01F93A\+01F93C-\+01F945\+01F947-\+01F9FF' ||
    U&'\+01FA58-\+01FA5F\+01FA6E-\+01FAFF\+01FC00-\+01FFFD]');
  extend_chars text := (U&'[\0300-\036F\0483-\0489\0591-\05BD\05BF\05C1-\05C2\05C4-\05C5' ||
    U&'\05C7-\05C9\0610-\061A\064B-\065F\0670\06D6-\06DC\06DF-\06E4' ||
    U&'\06E7-\06E8\06EA-\06ED\0711\0730-\074A\07A6-\07B0\07EB-\07F3\07FD' ||
    U&'\0816-\0819\081B-\0823\0825-\0827\0829-\082D\0859-\085B\0897-\089F' ||
    U&'\08CA-\08E1\08E3-\0902\093A\093C\0941-\0948\094D\0951-\0957' ||
    U&'\0962-\0963\0981\09BC\09BE\09C1-\09C4\09CD\09D7\09E2-\09E3\09FE' ||
    U&'\0A01-\0A02\0A3C\0A41-\0A42\0A47-\0A48\0A4B-\0A4D\0A51\0A70-\0A71' ||
    U&'\0A75\0A81-\0A82\0ABC\0AC1-\0AC5\0AC7-\0AC8\0ACD\0AE2-\0AE3' ||
    U&'\0AFA-\0AFF\0B01\0B3C\0B3E-\0B3F\0B41-\0B44\0B4D\0B53-\0B57' ||
    U&'\0B62-\0B63\0B82\0BBE\0BC0\0BCD\0BD7\0C00\0C04\0C3C\0C3E-\0C40' ||
    U&'\0C46-\0C48\0C4A-\0C4D\0C55-\0C56\0C62-\0C63\0C81\0CBC\0CBF-\0CC0' ||
    U&'\0CC2\0CC6-\0CC8\0CCA-\0CCD\0CD5-\0CD6\0CE2-\0CE3\0D00-\0D01' ||
    U&'\0D3B-\0D3C\0D3E\0D41-\0D44\0D4D\0D57\0D62-\0D63\0D81\0DCA\0DCF' ||
    U&'\0DD2-\0DD4\0DD6\0DDF\0E31\0E34-\0E3A\0E47-\0E4E\0EB1\0EB4-\0EBC' ||
    U&'\0EC8-\0ECE\0F18-\0F19\0F35\0F37\0F39\0F71-\0F7E\0F80-\0F84' ||
    U&'\0F86-\0F87\0F8D-\0F97\0F99-\0FBC\0FC6\102D-\1030\1032-\1037' ||
    U&'\1039-\103A\103D-\103E\1058-\1059\105E-\1060\1071-\1074\1082' ||
    U&'\1085-\1086\108D\109D\135D-\135F\1712-\1715\1732-\1734\1752-\1753' ||
    U&'\1772-\1773\17B4-\17B5\17B7-\17BD\17C6\17C9-\17D3\17DD\180B-\180D' ||
    U&'\180F\1885-\1886\18A9\1920-\1922\1927-\1928\1932\1939-\193B' ||
    U&'\1A17-\1A18\1A1B\1A56\1A58-\1A5E\1A60\1A62\1A65-\1A6C\1A73-\1A7C' ||
    U&'\1A7F\1AB0-\1AF0\1B00-\1B03\1B34-\1B3D\1B42-\1B44\1B6B-\1B73' ||
    U&'\1B80-\1B81\1BA2-\1BA5\1BA8-\1BAD\1BE6\1BE8-\1BE9\1BED\1BEF-\1BF3' ||
    U&'\1C2C-\1C33\1C36-\1C37\1CD0-\1CD2\1CD4-\1CE0\1CE2-\1CE8\1CED\1CF4' ||
    U&'\1CF8-\1CF9\1DC0-\1DFF\200C\20D0-\20F0\2CEF-\2CF1\2D7F\2DE0-\2DFF' ||
    U&'\302A-\302F\3099-\309A\A66F-\A672\A674-\A67D\A69E-\A69F\A6F0-\A6F1' ||
    U&'\A802\A806\A80B\A825-\A826\A82C\A8C4-\A8C5\A8E0-\A8F1\A8FF' ||
    U&'\A926-\A92D\A947-\A951\A953\A980-\A982\A9B3\A9B6-\A9B9\A9BC-\A9BD' ||
    U&'\A9C0\A9E5\AA29-\AA2E\AA31-\AA32\AA35-\AA36\AA43\AA4C\AA7C\AAB0' ||
    U&'\AAB2-\AAB4\AAB7-\AAB8\AABE-\AABF\AAC1\AAEC-\AAED\AAF6\ABE5\ABE8' ||
    U&'\ABED\FB1E\FE00-\FE0F\FE20-\FE2F\FF9E-\FF9F\+0101FD\+0102E0' ||
    U&'\+010376-\+01037A\+010A01-\+010A03\+010A05-\+010A06\+010A0C-\+010A0F' ||
    U&'\+010A38-\+010A3A\+010A3F\+010AE5-\+010AE6\+010D24-\+010D27' ||
    U&'\+010D69-\+010D6D\+010EAB-\+010EAC\+010ECB-\+010ECF\+010EF0-\+010EFF' ||
    U&'\+010F46-\+010F50\+010F82-\+010F85\+011001\+011038-\+011046\+011070' ||
    U&'\+011073-\+011074\+01107F-\+011081\+0110B3-\+0110B6\+0110B9-\+0110BA' ||
    U&'\+0110C2\+011100-\+011102\+011127-\+01112B\+01112D-\+011134\+011173' ||
    U&'\+011180-\+011181\+0111B6-\+0111BE\+0111C0\+0111C9-\+0111CC\+0111CF' ||
    U&'\+01122F-\+011231\+011234-\+011237\+01123E\+011241\+0112DF' ||
    U&'\+0112E3-\+0112EA\+011300-\+011301\+01133B-\+01133C\+01133E\+011340' ||
    U&'\+01134D\+011357\+011366-\+01136C\+011370-\+011374\+0113B8' ||
    U&'\+0113BB-\+0113C0\+0113C2\+0113C5\+0113C7-\+0113C9\+0113CE-\+0113D0' ||
    U&'\+0113D2\+0113E1-\+0113E2\+011438-\+01143F\+011442-\+011444\+011446' ||
    U&'\+01145E\+0114B0\+0114B3-\+0114B8\+0114BA\+0114BD\+0114BF-\+0114C0' ||
    U&'\+0114C2-\+0114C3\+0115AF\+0115B2-\+0115B5\+0115BC-\+0115BD' ||
    U&'\+0115BF-\+0115C0\+0115DC-\+0115DD\+011633-\+01163A\+01163D' ||
    U&'\+01163F-\+011640\+0116AB\+0116AD\+0116B0-\+0116B7\+01171D\+01171F' ||
    U&'\+011722-\+011725\+011727-\+01172B\+01182F-\+011837\+011839-\+01183A' ||
    U&'\+011930\+01193B-\+01193E\+011943\+0119D4-\+0119D7\+0119DA-\+0119DB' ||
    U&'\+0119E0\+011A01-\+011A0A\+011A33-\+011A38\+011A3B-\+011A3E\+011A47' ||
    U&'\+011A51-\+011A56\+011A59-\+011A5B\+011A8A-\+011A96\+011A98-\+011A99' ||
    U&'\+011B60\+011B62-\+011B64\+011B66\+011C30-\+011C36\+011C38-\+011C3D' ||
    U&'\+011C3F\+011C92-\+011CA7\+011CAA-\+011CB0\+011CB2-\+011CB3' ||
    U&'\+011CB5-\+011CB6\+011D31-\+011D36\+011D3A\+011D3C-\+011D3D' ||
    U&'\+011D3F-\+011D45\+011D47\+011D90-\+011D91\+011D95\+011D97\+011DF0' ||
    U&'\+011EF3-\+011EF4\+011F00-\+011F01\+011F36-\+011F3A\+011F40-\+011F42' ||
    U&'\+011F5A\+013440\+013447-\+013455\+01611E-\+016129\+01612D-\+01612F' ||
    U&'\+016AF0-\+016AF4\+016B30-\+016B36\+016F4F\+016F8F-\+016F92\+016FE4' ||
    U&'\+016FF0-\+016FF1\+01BC9D-\+01BC9E\+01CF00-\+01CF2D\+01CF30-\+01CF46' ||
    U&'\+01D127-\+01D128\+01D165-\+01D169\+01D16D-\+01D172\+01D17B-\+01D182' ||
    U&'\+01D185-\+01D18B\+01D1AA-\+01D1AD\+01D242-\+01D244\+01D250-\+01D252' ||
    U&'\+01D25B-\+01D25C\+01D25F\+01D280-\+01D281\+01DA00-\+01DA36' ||
    U&'\+01DA3B-\+01DA6C\+01DA75\+01DA84\+01DA9B-\+01DA9F\+01DAA1-\+01DAAF' ||
    U&'\+01E000-\+01E006\+01E008-\+01E018\+01E01B-\+01E021\+01E023-\+01E024' ||
    U&'\+01E026-\+01E02A\+01E08F\+01E130-\+01E136\+01E2AE\+01E2EC-\+01E2EF' ||
    U&'\+01E4EC-\+01E4EF\+01E5EE-\+01E5EF\+01E6E3\+01E6E6\+01E6EE-\+01E6EF' ||
    U&'\+01E6F5\+01E8D0-\+01E8D6\+01E944-\+01E94A\+01F3FB-\+01F3FF' ||
    U&'\+0E0020-\+0E007F\+0E0100-\+0E01EF]');
  spacing_marks text := (U&'[\0903\093B\093E-\0940\0949-\094C\094E-\094F\0982-\0983\09BF-\09C0' ||
    U&'\09C7-\09C8\09CB-\09CC\0A03\0A3E-\0A40\0A83\0ABE-\0AC0\0AC9' ||
    U&'\0ACB-\0ACC\0B02-\0B03\0B40\0B47-\0B48\0B4B-\0B4C\0BBF\0BC1-\0BC2' ||
    U&'\0BC6-\0BC8\0BCA-\0BCC\0C01-\0C03\0C41-\0C44\0C82-\0C83\0CBE\0CC1' ||
    U&'\0CC3-\0CC4\0CF3\0D02-\0D03\0D3F-\0D40\0D46-\0D48\0D4A-\0D4C' ||
    U&'\0D82-\0D83\0DD0-\0DD1\0DD8-\0DDE\0DF2-\0DF3\0E33\0EB3\0F3E-\0F3F' ||
    U&'\0F7F\1031\103B-\103C\1056-\1057\1084\17B6\17BE-\17C5\17C7-\17C8' ||
    U&'\1923-\1926\1929-\192B\1930-\1931\1933-\1938\1A19-\1A1A\1A55\1A57' ||
    U&'\1A6D-\1A72\1B04\1B3E-\1B41\1B82\1BA1\1BA6-\1BA7\1BE7\1BEA-\1BEC' ||
    U&'\1BEE\1C24-\1C2B\1C34-\1C35\1CE1\1CF7\A823-\A824\A827\A880-\A881' ||
    U&'\A8B4-\A8C3\A952\A983\A9B4-\A9B5\A9BA-\A9BB\A9BE-\A9BF\AA2F-\AA30' ||
    U&'\AA33-\AA34\AA4D\AAEB\AAEE-\AAEF\AAF5\ABE3-\ABE4\ABE6-\ABE7' ||
    U&'\ABE9-\ABEA\ABEC\+011000\+011002\+011082\+0110B0-\+0110B2' ||
    U&'\+0110B7-\+0110B8\+01112C\+011145-\+011146\+011182\+0111B3-\+0111B5' ||
    U&'\+0111BF\+0111CE\+01122C-\+01122E\+011232-\+011233\+0112E0-\+0112E2' ||
    U&'\+011302-\+011303\+01133F\+011341-\+011344\+011347-\+011348' ||
    U&'\+01134B-\+01134C\+011362-\+011363\+0113B9-\+0113BA\+0113CA' ||
    U&'\+0113CC-\+0113CD\+011435-\+011437\+011440-\+011441\+011445' ||
    U&'\+0114B1-\+0114B2\+0114B9\+0114BB-\+0114BC\+0114BE\+0114C1' ||
    U&'\+0115B0-\+0115B1\+0115B8-\+0115BB\+0115BE\+011630-\+011632' ||
    U&'\+01163B-\+01163C\+01163E\+0116AC\+0116AE-\+0116AF\+01171E\+011726' ||
    U&'\+01182C-\+01182E\+011838\+011931-\+011935\+011937-\+011938\+011940' ||
    U&'\+011942\+0119D1-\+0119D3\+0119DC-\+0119DF\+0119E4\+011A39' ||
    U&'\+011A57-\+011A58\+011A97\+011B61\+011B65\+011B67\+011C2F\+011C3E' ||
    U&'\+011CA9\+011CB1\+011CB4\+011D8A-\+011D8E\+011D93-\+011D94\+011D96' ||
    U&'\+011EF5-\+011EF6\+011F03\+011F34-\+011F35\+011F3E-\+011F3F' ||
    U&'\+01612A-\+01612C\+016F51-\+016F87]');
  prepend_chars text := (U&'[\0600-\0605\06DD\070F\0890-\0891\08E2\0D4E\+0110BD\+0110CD' ||
    U&'\+0111C2-\+0111C3\+0113D1\+01193F\+011941\+011A84-\+011A89\+011D46' ||
    U&'\+011F02]');
  hangul_l text := (U&'[\1100-\115F\A960-\A97C]');
  hangul_v text := (U&'[\1160-\11A7\D7B0-\D7C6\+016D63\+016D67-\+016D6A]');
  hangul_t text := (U&'[\11A8-\11FF\D7CB-\D7FB]');
  consonants text := (U&'[\0915-\0939\0958-\095F\0978-\097F\0995-\09A8\09AA-\09B0\09B2' ||
    U&'\09B6-\09B9\09DC-\09DD\09DF\09F0-\09F1\0A95-\0AA8\0AAA-\0AB0' ||
    U&'\0AB2-\0AB3\0AB5-\0AB9\0AF9\0B15-\0B28\0B2A-\0B30\0B32-\0B33' ||
    U&'\0B35-\0B39\0B5C-\0B5D\0B5F\0B71\0C15-\0C28\0C2A-\0C39\0C58-\0C5A' ||
    U&'\0D15-\0D3A\1000-\102A\103F\1050-\1055\105A-\105D\1061\1065-\1066' ||
    U&'\106E-\1070\1075-\1081\108E\1780-\17B3\1A20-\1A54\1B0B-\1B0C' ||
    U&'\1B13-\1B33\1B45-\1B4C\1B83-\1BA0\1BAE-\1BAF\1BBB-\1BBD\A989-\A98B' ||
    U&'\A98F-\A9B2\A9E0-\A9E4\A9E7-\A9EF\A9FA-\A9FE\AA60-\AA6F\AA71-\AA73' ||
    U&'\AA7A\AA7E-\AA7F\AAE0-\AAEA\ABC0-\ABDA\+010A00\+010A10-\+010A13' ||
    U&'\+010A15-\+010A17\+010A19-\+010A35\+011103-\+011126\+011144\+011147' ||
    U&'\+011380-\+011389\+01138B\+01138E\+011390-\+0113B5\+011900-\+011906' ||
    U&'\+011909\+01190C-\+011913\+011915-\+011916\+011918-\+01192F\+011A00' ||
    U&'\+011A0B-\+011A32\+011A50\+011A5C-\+011A83\+011B0A\+011DF1' ||
    U&'\+011F04-\+011F10\+011F12-\+011F33]');
  linkers text := (U&'[\094D\09CD\0ACD\0B4D\0C4D\0D4D\1039\17D2\1A60\1B44\1BAB\1CF5-\1CF6' ||
    U&'\A9C0\AAF6\+010A3F\+011133\+0113D0\+01193E\+011A3A\+011A47\+011A99' ||
    U&'\+011F42]');
  conjunct_extend text := (U&'[\0300-\036F\0483-\0489\0591-\05BD\05BF\05C1-\05C2\05C4-\05C5' ||
    U&'\05C7-\05C9\0610-\061A\064B-\065F\0670\06D6-\06DC\06DF-\06E4' ||
    U&'\06E7-\06E8\06EA-\06ED\0711\0730-\074A\07A6-\07B0\07EB-\07F3\07FD' ||
    U&'\0816-\0819\081B-\0823\0825-\0827\0829-\082D\0859-\085B\0897-\089F' ||
    U&'\08CA-\08E1\08E3-\0902\093A\093C\0941-\0948\0951-\0957\0962-\0963' ||
    U&'\0981\09BC\09BE\09C1-\09C4\09D7\09E2-\09E3\09FE\0A01-\0A02\0A3C' ||
    U&'\0A41-\0A42\0A47-\0A48\0A4B-\0A4D\0A51\0A70-\0A71\0A75\0A81-\0A82' ||
    U&'\0ABC\0AC1-\0AC5\0AC7-\0AC8\0AE2-\0AE3\0AFA-\0AFF\0B01\0B3C' ||
    U&'\0B3E-\0B3F\0B41-\0B44\0B53-\0B57\0B62-\0B63\0B82\0BBE\0BC0\0BCD' ||
    U&'\0BD7\0C00\0C04\0C3C\0C3E-\0C40\0C46-\0C48\0C4A-\0C4C\0C55-\0C56' ||
    U&'\0C62-\0C63\0C81\0CBC\0CBF-\0CC0\0CC2\0CC6-\0CC8\0CCA-\0CCD' ||
    U&'\0CD5-\0CD6\0CE2-\0CE3\0D00-\0D01\0D3B-\0D3C\0D3E\0D41-\0D44\0D57' ||
    U&'\0D62-\0D63\0D81\0DCA\0DCF\0DD2-\0DD4\0DD6\0DDF\0E31\0E34-\0E3A' ||
    U&'\0E47-\0E4E\0EB1\0EB4-\0EBC\0EC8-\0ECE\0F18-\0F19\0F35\0F37\0F39' ||
    U&'\0F71-\0F7E\0F80-\0F84\0F86-\0F87\0F8D-\0F97\0F99-\0FBC\0FC6' ||
    U&'\102D-\1030\1032-\1037\103A\103D-\103E\1058-\1059\105E-\1060' ||
    U&'\1071-\1074\1082\1085-\1086\108D\109D\135D-\135F\1712-\1715' ||
    U&'\1732-\1734\1752-\1753\1772-\1773\17B4-\17B5\17B7-\17BD\17C6' ||
    U&'\17C9-\17D1\17D3\17DD\180B-\180D\180F\1885-\1886\18A9\1920-\1922' ||
    U&'\1927-\1928\1932\1939-\193B\1A17-\1A18\1A1B\1A56\1A58-\1A5E\1A62' ||
    U&'\1A65-\1A6C\1A73-\1A7C\1A7F\1AB0-\1AF0\1B00-\1B03\1B34-\1B3D' ||
    U&'\1B42-\1B43\1B6B-\1B73\1B80-\1B81\1BA2-\1BA5\1BA8-\1BAA\1BAC-\1BAD' ||
    U&'\1BE6\1BE8-\1BE9\1BED\1BEF-\1BF3\1C2C-\1C33\1C36-\1C37\1CD0-\1CD2' ||
    U&'\1CD4-\1CE0\1CE2-\1CE8\1CED\1CF4\1CF8-\1CF9\1DC0-\1DFF\200D' ||
    U&'\20D0-\20F0\2CEF-\2CF1\2D7F\2DE0-\2DFF\302A-\302F\3099-\309A' ||
    U&'\A66F-\A672\A674-\A67D\A69E-\A69F\A6F0-\A6F1\A802\A806\A80B' ||
    U&'\A825-\A826\A82C\A8C4-\A8C5\A8E0-\A8F1\A8FF\A926-\A92D\A947-\A951' ||
    U&'\A953\A980-\A982\A9B3\A9B6-\A9B9\A9BC-\A9BD\A9E5\AA29-\AA2E' ||
    U&'\AA31-\AA32\AA35-\AA36\AA43\AA4C\AA7C\AAB0\AAB2-\AAB4\AAB7-\AAB8' ||
    U&'\AABE-\AABF\AAC1\AAEC-\AAED\ABE5\ABE8\ABED\FB1E\FE00-\FE0F' ||
    U&'\FE20-\FE2F\FF9E-\FF9F\+0101FD\+0102E0\+010376-\+01037A' ||
    U&'\+010A01-\+010A03\+010A05-\+010A06\+010A0C-\+010A0F\+010A38-\+010A3A' ||
    U&'\+010AE5-\+010AE6\+010D24-\+010D27\+010D69-\+010D6D\+010EAB-\+010EAC' ||
    U&'\+010ECB-\+010ECF\+010EF0-\+010EFF\+010F46-\+010F50\+010F82-\+010F85' ||
    U&'\+011001\+011038-\+011046\+011070\+011073-\+011074\+01107F-\+011081' ||
    U&'\+0110B3-\+0110B6\+0110B9-\+0110BA\+0110C2\+011100-\+011102' ||
    U&'\+011127-\+01112B\+01112D-\+011132\+011134\+011173\+011180-\+011181' ||
    U&'\+0111B6-\+0111BE\+0111C0\+0111C9-\+0111CC\+0111CF\+01122F-\+011231' ||
    U&'\+011234-\+011237\+01123E\+011241\+0112DF\+0112E3-\+0112EA' ||
    U&'\+011300-\+011301\+01133B-\+01133C\+01133E\+011340\+01134D\+011357' ||
    U&'\+011366-\+01136C\+011370-\+011374\+0113B8\+0113BB-\+0113C0\+0113C2' ||
    U&'\+0113C5\+0113C7-\+0113C9\+0113CE-\+0113CF\+0113D2\+0113E1-\+0113E2' ||
    U&'\+011438-\+01143F\+011442-\+011444\+011446\+01145E\+0114B0' ||
    U&'\+0114B3-\+0114B8\+0114BA\+0114BD\+0114BF-\+0114C0\+0114C2-\+0114C3' ||
    U&'\+0115AF\+0115B2-\+0115B5\+0115BC-\+0115BD\+0115BF-\+0115C0' ||
    U&'\+0115DC-\+0115DD\+011633-\+01163A\+01163D\+01163F-\+011640\+0116AB' ||
    U&'\+0116AD\+0116B0-\+0116B7\+01171D\+01171F\+011722-\+011725' ||
    U&'\+011727-\+01172B\+01182F-\+011837\+011839-\+01183A\+011930' ||
    U&'\+01193B-\+01193D\+011943\+0119D4-\+0119D7\+0119DA-\+0119DB\+0119E0' ||
    U&'\+011A01-\+011A0A\+011A33-\+011A38\+011A3B-\+011A3E\+011A51-\+011A56' ||
    U&'\+011A59-\+011A5B\+011A8A-\+011A96\+011A98\+011B60\+011B62-\+011B64' ||
    U&'\+011B66\+011C30-\+011C36\+011C38-\+011C3D\+011C3F\+011C92-\+011CA7' ||
    U&'\+011CAA-\+011CB0\+011CB2-\+011CB3\+011CB5-\+011CB6\+011D31-\+011D36' ||
    U&'\+011D3A\+011D3C-\+011D3D\+011D3F-\+011D45\+011D47\+011D90-\+011D91' ||
    U&'\+011D95\+011D97\+011DF0\+011EF3-\+011EF4\+011F00-\+011F01' ||
    U&'\+011F36-\+011F3A\+011F40-\+011F41\+011F5A\+013440\+013447-\+013455' ||
    U&'\+01611E-\+016129\+01612D-\+01612F\+016AF0-\+016AF4\+016B30-\+016B36' ||
    U&'\+016F4F\+016F8F-\+016F92\+016FE4\+016FF0-\+016FF1\+01BC9D-\+01BC9E' ||
    U&'\+01CF00-\+01CF2D\+01CF30-\+01CF46\+01D127-\+01D128\+01D165-\+01D169' ||
    U&'\+01D16D-\+01D172\+01D17B-\+01D182\+01D185-\+01D18B\+01D1AA-\+01D1AD' ||
    U&'\+01D242-\+01D244\+01D250-\+01D252\+01D25B-\+01D25C\+01D25F' ||
    U&'\+01D280-\+01D281\+01DA00-\+01DA36\+01DA3B-\+01DA6C\+01DA75\+01DA84' ||
    U&'\+01DA9B-\+01DA9F\+01DAA1-\+01DAAF\+01E000-\+01E006\+01E008-\+01E018' ||
    U&'\+01E01B-\+01E021\+01E023-\+01E024\+01E026-\+01E02A\+01E08F' ||
    U&'\+01E130-\+01E136\+01E2AE\+01E2EC-\+01E2EF\+01E4EC-\+01E4EF' ||
    U&'\+01E5EE-\+01E5EF\+01E6E3\+01E6E6\+01E6EE-\+01E6EF\+01E6F5' ||
    U&'\+01E8D0-\+01E8D6\+01E944-\+01E94A\+01F3FB-\+01F3FF\+0E0020-\+0E007F' ||
    U&'\+0E0100-\+0E01EF]');
  marks text := (U&'[\0300-\036F\0483-\0489\0591-\05BD\05BF\05C1-\05C2\05C4-\05C5' ||
    U&'\05C7-\05C9\0610-\061A\064B-\065F\0670\06D6-\06DC\06DF-\06E4' ||
    U&'\06E7-\06E8\06EA-\06ED\0711\0730-\074A\07A6-\07B0\07EB-\07F3\07FD' ||
    U&'\0816-\0819\081B-\0823\0825-\0827\0829-\082D\0859-\085B\0897-\089F' ||
    U&'\08CA-\08E1\08E3-\0903\093A-\093C\093E-\094F\0951-\0957\0962-\0963' ||
    U&'\0981-\0983\09BC\09BE-\09C4\09C7-\09C8\09CB-\09CD\09D7\09E2-\09E3' ||
    U&'\09FE\0A01-\0A03\0A3C\0A3E-\0A42\0A47-\0A48\0A4B-\0A4D\0A51' ||
    U&'\0A70-\0A71\0A75\0A81-\0A83\0ABC\0ABE-\0AC5\0AC7-\0AC9\0ACB-\0ACD' ||
    U&'\0AE2-\0AE3\0AFA-\0AFF\0B01-\0B03\0B3C\0B3E-\0B44\0B47-\0B48' ||
    U&'\0B4B-\0B4D\0B53-\0B57\0B62-\0B63\0B82\0BBE-\0BC2\0BC6-\0BC8' ||
    U&'\0BCA-\0BCD\0BD7\0C00-\0C04\0C3C\0C3E-\0C44\0C46-\0C48\0C4A-\0C4D' ||
    U&'\0C55-\0C56\0C62-\0C63\0C81-\0C83\0CBC\0CBE-\0CC4\0CC6-\0CC8' ||
    U&'\0CCA-\0CCD\0CD5-\0CD6\0CE2-\0CE3\0CF3\0D00-\0D03\0D3B-\0D3C' ||
    U&'\0D3E-\0D44\0D46-\0D48\0D4A-\0D4D\0D57\0D62-\0D63\0D81-\0D83\0DCA' ||
    U&'\0DCF-\0DD4\0DD6\0DD8-\0DDF\0DF2-\0DF3\0E31\0E34-\0E3A\0E47-\0E4E' ||
    U&'\0EB1\0EB4-\0EBC\0EC8-\0ECE\0F18-\0F19\0F35\0F37\0F39\0F3E-\0F3F' ||
    U&'\0F71-\0F84\0F86-\0F87\0F8D-\0F97\0F99-\0FBC\0FC6\102B-\103E' ||
    U&'\1056-\1059\105E-\1060\1062-\1064\1067-\106D\1071-\1074\1082-\108D' ||
    U&'\108F\109A-\109D\135D-\135F\1712-\1715\1732-\1734\1752-\1753' ||
    U&'\1772-\1773\17B4-\17D3\17DD\180B-\180D\180F\1885-\1886\18A9' ||
    U&'\1920-\192B\1930-\193B\1A17-\1A1B\1A55-\1A5E\1A60-\1A7C\1A7F' ||
    U&'\1AB0-\1AF0\1B00-\1B04\1B34-\1B44\1B6B-\1B73\1B80-\1B82\1BA1-\1BAD' ||
    U&'\1BE6-\1BF3\1C24-\1C37\1CD0-\1CD2\1CD4-\1CE8\1CED\1CF4\1CF7-\1CF9' ||
    U&'\1DC0-\1DFF\20D0-\20F0\2CEF-\2CF1\2D7F\2DE0-\2DFF\302A-\302F' ||
    U&'\3099-\309A\A66F-\A672\A674-\A67D\A69E-\A69F\A6F0-\A6F1\A802\A806' ||
    U&'\A80B\A823-\A827\A82C\A880-\A881\A8B4-\A8C5\A8E0-\A8F1\A8FF' ||
    U&'\A926-\A92D\A947-\A953\A980-\A983\A9B3-\A9C0\A9E5\AA29-\AA36\AA43' ||
    U&'\AA4C-\AA4D\AA7B-\AA7D\AAB0\AAB2-\AAB4\AAB7-\AAB8\AABE-\AABF\AAC1' ||
    U&'\AAEB-\AAEF\AAF5-\AAF6\ABE3-\ABEA\ABEC-\ABED\FB1E\FE00-\FE0F' ||
    U&'\FE20-\FE2F\+0101FD\+0102E0\+010376-\+01037A\+010A01-\+010A03' ||
    U&'\+010A05-\+010A06\+010A0C-\+010A0F\+010A38-\+010A3A\+010A3F' ||
    U&'\+010AE5-\+010AE6\+010D24-\+010D27\+010D69-\+010D6D\+010EAB-\+010EAC' ||
    U&'\+010ECB-\+010ECF\+010EF0-\+010EFF\+010F46-\+010F50\+010F82-\+010F85' ||
    U&'\+011000-\+011002\+011038-\+011046\+011070\+011073-\+011074' ||
    U&'\+01107F-\+011082\+0110B0-\+0110BA\+0110C2\+011100-\+011102' ||
    U&'\+011127-\+011134\+011145-\+011146\+011173\+011180-\+011182' ||
    U&'\+0111B3-\+0111C0\+0111C9-\+0111CC\+0111CE-\+0111CF\+01122C-\+011237' ||
    U&'\+01123E\+011241\+0112DF-\+0112EA\+011300-\+011303\+01133B-\+01133C' ||
    U&'\+01133E-\+011344\+011347-\+011348\+01134B-\+01134D\+011357' ||
    U&'\+011362-\+011363\+011366-\+01136C\+011370-\+011374\+0113B8-\+0113C0' ||
    U&'\+0113C2\+0113C5\+0113C7-\+0113CA\+0113CC-\+0113D0\+0113D2' ||
    U&'\+0113E1-\+0113E2\+011435-\+011446\+01145E\+0114B0-\+0114C3' ||
    U&'\+0115AF-\+0115B5\+0115B8-\+0115C0\+0115DC-\+0115DD\+011630-\+011640' ||
    U&'\+0116AB-\+0116B7\+01171D-\+01172B\+01182C-\+01183A\+011930-\+011935' ||
    U&'\+011937-\+011938\+01193B-\+01193E\+011940\+011942-\+011943' ||
    U&'\+0119D1-\+0119D7\+0119DA-\+0119E0\+0119E4\+011A01-\+011A0A' ||
    U&'\+011A33-\+011A39\+011A3B-\+011A3E\+011A47\+011A51-\+011A5B' ||
    U&'\+011A8A-\+011A99\+011B60-\+011B67\+011C2F-\+011C36\+011C38-\+011C3F' ||
    U&'\+011C92-\+011CA7\+011CA9-\+011CB6\+011D31-\+011D36\+011D3A' ||
    U&'\+011D3C-\+011D3D\+011D3F-\+011D45\+011D47\+011D8A-\+011D8E' ||
    U&'\+011D90-\+011D91\+011D93-\+011D97\+011DF0\+011EF3-\+011EF6' ||
    U&'\+011F00-\+011F01\+011F03\+011F34-\+011F3A\+011F3E-\+011F42\+011F5A' ||
    U&'\+013440\+013447-\+013455\+01611E-\+01612F\+016AF0-\+016AF4' ||
    U&'\+016B30-\+016B36\+016F4F\+016F51-\+016F87\+016F8F-\+016F92\+016FE4' ||
    U&'\+016FF0-\+016FF1\+01BC9D-\+01BC9E\+01CF00-\+01CF2D\+01CF30-\+01CF46' ||
    U&'\+01D127-\+01D128\+01D165-\+01D169\+01D16D-\+01D172\+01D17B-\+01D182' ||
    U&'\+01D185-\+01D18B\+01D1AA-\+01D1AD\+01D242-\+01D244\+01D250-\+01D252' ||
    U&'\+01D25B-\+01D25C\+01D25F\+01D280-\+01D281\+01DA00-\+01DA36' ||
    U&'\+01DA3B-\+01DA6C\+01DA75\+01DA84\+01DA9B-\+01DA9F\+01DAA1-\+01DAAF' ||
    U&'\+01E000-\+01E006\+01E008-\+01E018\+01E01B-\+01E021\+01E023-\+01E024' ||
    U&'\+01E026-\+01E02A\+01E08F\+01E130-\+01E136\+01E2AE\+01E2EC-\+01E2EF' ||
    U&'\+01E4EC-\+01E4EF\+01E5EE-\+01E5EF\+01E6E3\+01E6E6\+01E6EE-\+01E6EF' ||
    U&'\+01E6F5\+01E8D0-\+01E8D6\+01E944-\+01E94A\+0E0100-\+0E01EF]');
  hidden text := (U&'[\0001-\0020\007f-\00a0\00ad\0378-\0379\0380-\0383\038b\038d\03a2' ||
    U&'\0530\0557-\0558\058b-\058c\0590\05c8-\05cf\05eb-\05ee\05f5-\0605' ||
    U&'\061c\06dd\070e-\070f\074b-\074c\07b2-\07bf\07fb-\07fc\082e-\082f' ||
    U&'\083f\085c-\085d\085f\086b-\086f\0890-\0896\08e2\0984\098d-\098e' ||
    U&'\0991-\0992\09a9\09b1\09b3-\09b5\09ba-\09bb\09c5-\09c6\09c9-\09ca' ||
    U&'\09cf-\09d6\09d8-\09db\09de\09e4-\09e5\09ff-\0a00\0a04\0a0b-\0a0e' ||
    U&'\0a11-\0a12\0a29\0a31\0a34\0a37\0a3a-\0a3b\0a3d\0a43-\0a46' ||
    U&'\0a49-\0a4a\0a4e-\0a50\0a52-\0a58\0a5d\0a5f-\0a65\0a77-\0a80\0a84' ||
    U&'\0a8e\0a92\0aa9\0ab1\0ab4\0aba-\0abb\0ac6\0aca\0ace-\0acf\0ad1-\0adf' ||
    U&'\0ae4-\0ae5\0af2-\0af8\0b00\0b04\0b0d-\0b0e\0b11-\0b12\0b29\0b31' ||
    U&'\0b34\0b3a-\0b3b\0b45-\0b46\0b49-\0b4a\0b4e-\0b54\0b58-\0b5b\0b5e' ||
    U&'\0b64-\0b65\0b78-\0b81\0b84\0b8b-\0b8d\0b91\0b96-\0b98\0b9b\0b9d' ||
    U&'\0ba0-\0ba2\0ba5-\0ba7\0bab-\0bad\0bba-\0bbd\0bc3-\0bc5\0bc9' ||
    U&'\0bce-\0bcf\0bd1-\0bd6\0bd8-\0be5\0bfb-\0bff\0c0d\0c11\0c29' ||
    U&'\0c3a-\0c3b\0c45\0c49\0c4e-\0c54\0c57\0c5b\0c5e-\0c5f\0c64-\0c65' ||
    U&'\0c70-\0c76\0c8d\0c91\0ca9\0cb4\0cba-\0cbb\0cc5\0cc9\0cce-\0cd4' ||
    U&'\0cd7-\0cdb\0cdf\0ce4-\0ce5\0cf0\0cf4-\0cff\0d0d\0d11\0d45\0d49' ||
    U&'\0d50-\0d53\0d64-\0d65\0d80\0d84\0d97-\0d99\0db2\0dbc\0dbe-\0dbf' ||
    U&'\0dc7-\0dc9\0dcb-\0dce\0dd5\0dd7\0de0-\0de5\0df0-\0df1\0df5-\0e00' ||
    U&'\0e3b-\0e3e\0e5c-\0e80\0e83\0e85\0e8b\0ea4\0ea6\0ebe-\0ebf\0ec5\0ec7' ||
    U&'\0ecf\0eda-\0edb\0ee0-\0eff\0f48\0f6d-\0f70\0f98\0fbd\0fcd' ||
    U&'\0fdb-\0fff\10c6\10c8-\10cc\10ce-\10cf\1249\124e-\124f\1257\1259' ||
    U&'\125e-\125f\1289\128e-\128f\12b1\12b6-\12b7\12bf\12c1\12c6-\12c7' ||
    U&'\12d7\1311\1316-\1317\135b-\135c\137d-\137f\139a-\139f\13f6-\13f7' ||
    U&'\13fe-\13ff\1680\169d-\169f\16f9-\16ff\1716-\171e\1737-\173f' ||
    U&'\1754-\175f\176d\1771\1774-\177f\17de-\17df\17ea-\17ef\17fa-\17ff' ||
    U&'\180e\181a-\181f\1879-\187f\18ab-\18af\18f6-\18ff\191f\192c-\192f' ||
    U&'\193c-\193f\1941-\1943\196e-\196f\1975-\197f\19ac-\19af\19ca-\19cf' ||
    U&'\19db-\19dd\1a1c-\1a1d\1a5f\1a7d-\1a7e\1a8a-\1a8f\1a9a-\1a9f' ||
    U&'\1aae-\1aaf\1ade-\1adf\1aec-\1aff\1b4d\1bf4-\1bfb\1c38-\1c3a' ||
    U&'\1c4a-\1c4c\1c8b-\1c8f\1cbb-\1cbc\1cc8-\1ccf\1cfb-\1cff\1f16-\1f17' ||
    U&'\1f1e-\1f1f\1f46-\1f47\1f4e-\1f4f\1f58\1f5a\1f5c\1f5e\1f7e-\1f7f' ||
    U&'\1fb5\1fc5\1fd4-\1fd5\1fdc\1ff0-\1ff1\1ff5\1fff-\200c\200e-\200f' ||
    U&'\2028-\202f\205f-\206f\2072-\2073\208f\209d-\209f\20c2-\20cf' ||
    U&'\20f1-\20ff\218c-\218f\242a-\243f\244b-\245f\2b74-\2b75\2cf4-\2cf8' ||
    U&'\2d26\2d28-\2d2c\2d2e-\2d2f\2d68-\2d6e\2d71-\2d7e\2d97-\2d9f\2da7' ||
    U&'\2daf\2db7\2dbf\2dc7\2dcf\2dd7\2ddf\2e5e-\2e7f\2e9a\2ef4-\2eff' ||
    U&'\2fd6-\2fef\3000\3040\3097-\3098\3100-\3104\3130\318f\31e6-\31ee' ||
    U&'\321f\a48d-\a48f\a4c7-\a4cf\a62c-\a63f\a6f8-\a6ff\a7dd-\a7f0' ||
    U&'\a82d-\a82f\a83a-\a83f\a878-\a87f\a8c6-\a8cd\a8da-\a8df\a954-\a95e' ||
    U&'\a97d-\a97f\a9ce\a9da-\a9dd\a9ff\aa37-\aa3f\aa4e-\aa4f\aa5a-\aa5b' ||
    U&'\aac3-\aada\aaf7-\ab00\ab07-\ab08\ab0f-\ab10\ab17-\ab1f\ab27\ab2f' ||
    U&'\ab6c-\ab6f\abee-\abef\abfa-\abff\d7a4-\d7af\d7c7-\d7ca\d7fc-\f8ff' ||
    U&'\fa6e-\fa6f\fada-\faff\fb07-\fb12\fb18-\fb1c\fb37\fb3d\fb3f\fb42' ||
    U&'\fb45\fdd0-\fdef\fe1a-\fe1f\fe53\fe67\fe6c-\fe6f\fe75\fefd-\ff00' ||
    U&'\ffbf-\ffc1\ffc8-\ffc9\ffd0-\ffd1\ffd8-\ffd9\ffdd-\ffdf\ffe7' ||
    U&'\ffef-\fffb\fffe-\ffff\+01000c\+010027\+01003b\+01003e' ||
    U&'\+01004e-\+01004f\+01005e-\+01007f\+0100fb-\+0100ff\+010103-\+010106' ||
    U&'\+010134-\+010136\+01018f\+01019d-\+01019f\+0101a1-\+0101cf' ||
    U&'\+0101fe-\+01027f\+01029d-\+01029f\+0102d1-\+0102df\+0102fc-\+0102ff' ||
    U&'\+010324-\+01032c\+01034b-\+01034f\+01037b-\+01037f\+01039e' ||
    U&'\+0103c4-\+0103c7\+0103d6-\+0103ff\+01049e-\+01049f\+0104aa-\+0104af' ||
    U&'\+0104d4-\+0104d7\+0104fc-\+0104ff\+010528-\+01052f\+010564-\+01056e' ||
    U&'\+01057b\+01058b\+010593\+010596\+0105a2\+0105b2\+0105ba' ||
    U&'\+0105bd-\+0105bf\+0105f4-\+0105ff\+010737-\+01073f\+010756-\+01075f' ||
    U&'\+010768-\+01077f\+010786\+0107b1\+0107bb-\+0107ff\+010806-\+010807' ||
    U&'\+010809\+010836\+010839-\+01083b\+01083d-\+01083e\+010856' ||
    U&'\+01089f-\+0108a6\+0108b0-\+0108df\+0108f3\+0108f6-\+0108fa' ||
    U&'\+01091c-\+01091e\+01093a-\+01093e\+01095a-\+01097f\+0109b8-\+0109bb' ||
    U&'\+0109d0-\+0109d1\+010a04\+010a07-\+010a0b\+010a14\+010a18' ||
    U&'\+010a36-\+010a37\+010a3b-\+010a3e\+010a49-\+010a4f\+010a59-\+010a5f' ||
    U&'\+010aa0-\+010abf\+010ae7-\+010aea\+010af7-\+010aff\+010b36-\+010b38' ||
    U&'\+010b56-\+010b57\+010b73-\+010b77\+010b92-\+010b98\+010b9d-\+010ba8' ||
    U&'\+010bb0-\+010bff\+010c49-\+010c7f\+010cb3-\+010cbf\+010cf3-\+010cf9' ||
    U&'\+010d28-\+010d2f\+010d3a-\+010d3f\+010d66-\+010d68\+010d86-\+010d8d' ||
    U&'\+010d90-\+010e5f\+010e7f\+010eaa\+010eae-\+010eaf\+010eb2-\+010ec1' ||
    U&'\+010ec8-\+010ecf\+010ed9-\+010ef9\+010f28-\+010f2f\+010f5a-\+010f6f' ||
    U&'\+010f8a-\+010faf\+010fcc-\+010fdf\+010ff7-\+010fff\+01104e-\+011051' ||
    U&'\+011076-\+01107e\+0110bd\+0110c3-\+0110cf\+0110e9-\+0110ef' ||
    U&'\+0110fa-\+0110ff\+011135\+011148-\+01114f\+011177-\+01117f\+0111e0' ||
    U&'\+0111f5-\+0111ff\+011212\+011242-\+01127f\+011287\+011289\+01128e' ||
    U&'\+01129e\+0112aa-\+0112af\+0112eb-\+0112ef\+0112fa-\+0112ff\+011304' ||
    U&'\+01130d-\+01130e\+011311-\+011312\+011329\+011331\+011334\+01133a' ||
    U&'\+011345-\+011346\+011349-\+01134a\+01134e-\+01134f\+011351-\+011356' ||
    U&'\+011358-\+01135c\+011364-\+011365\+01136d-\+01136f\+011375-\+01137f' ||
    U&'\+01138a\+01138c-\+01138d\+01138f\+0113b6\+0113c1\+0113c3-\+0113c4' ||
    U&'\+0113c6\+0113cb\+0113d6\+0113d9-\+0113e0\+0113e3-\+0113ff\+01145c' ||
    U&'\+011462-\+01147f\+0114c8-\+0114cf\+0114da-\+01157f\+0115b6-\+0115b7' ||
    U&'\+0115de-\+0115ff\+011645-\+01164f\+01165a-\+01165f\+01166d-\+01167f' ||
    U&'\+0116ba-\+0116bf\+0116ca-\+0116cf\+0116e4-\+0116ff\+01171b-\+01171c' ||
    U&'\+01172c-\+01172f\+011747-\+0117ff\+01183c-\+01189f\+0118f3-\+0118fe' ||
    U&'\+011907-\+011908\+01190a-\+01190b\+011914\+011917\+011936' ||
    U&'\+011939-\+01193a\+011947-\+01194f\+01195a-\+01199f\+0119a8-\+0119a9' ||
    U&'\+0119d8-\+0119d9\+0119e5-\+0119ff\+011a48-\+011a4f\+011aa3-\+011aaf' ||
    U&'\+011af9-\+011aff\+011b0a-\+011b5f\+011b68-\+011bbf\+011be2-\+011bef' ||
    U&'\+011bfa-\+011bff\+011c09\+011c37\+011c46-\+011c4f\+011c6d-\+011c6f' ||
    U&'\+011c90-\+011c91\+011ca8\+011cb7-\+011cff\+011d07\+011d0a' ||
    U&'\+011d37-\+011d39\+011d3b\+011d3e\+011d48-\+011d4f\+011d5a-\+011d5f' ||
    U&'\+011d66\+011d69\+011d8f\+011d92\+011d99-\+011d9f\+011daa-\+011daf' ||
    U&'\+011ddc-\+011ddf\+011dea-\+011edf\+011ef9-\+011eff\+011f11' ||
    U&'\+011f3b-\+011f3d\+011f5b-\+011faf\+011fb1-\+011fbf\+011ff2-\+011ffe' ||
    U&'\+01239a-\+0123ff\+01246f\+012475-\+01247f\+012544-\+012f8f' ||
    U&'\+012ff3-\+012fff\+013430-\+01343f\+013456-\+01345f\+0143fb-\+0143ff' ||
    U&'\+014647-\+0160ff\+01613a-\+0167ff\+016a39-\+016a3f\+016a5f' ||
    U&'\+016a6a-\+016a6d\+016abf\+016aca-\+016acf\+016aee-\+016aef' ||
    U&'\+016af6-\+016aff\+016b46-\+016b4f\+016b5a\+016b62\+016b78-\+016b7c' ||
    U&'\+016b90-\+016d3f\+016d7a-\+016e3f\+016e9b-\+016e9f\+016eb9-\+016eba' ||
    U&'\+016ed4-\+016eff\+016f4b-\+016f4e\+016f88-\+016f8e\+016fa0-\+016fdf' ||
    U&'\+016fe5-\+016fef\+016ff7-\+016fff\+018cd6-\+018cfe\+018d1f-\+018d7f' ||
    U&'\+018df3-\+01afef\+01aff4\+01affc\+01afff\+01b123-\+01b131' ||
    U&'\+01b133-\+01b14f\+01b153-\+01b154\+01b156-\+01b163\+01b168-\+01b16f' ||
    U&'\+01b2fc-\+01bbff\+01bc6b-\+01bc6f\+01bc7d-\+01bc7f\+01bc89-\+01bc8f' ||
    U&'\+01bc9a-\+01bc9b\+01bca0-\+01cbff\+01ccfd-\+01ccff\+01ceb4-\+01ceb9' ||
    U&'\+01ced1-\+01cedf\+01cef1-\+01ceff\+01cf2e-\+01cf2f\+01cf47-\+01cf4f' ||
    U&'\+01cfc4-\+01cfff\+01d0f6-\+01d0ff\+01d127-\+01d128\+01d173-\+01d17a' ||
    U&'\+01d1eb-\+01d1ff\+01d246-\+01d2bf\+01d2d4-\+01d2df\+01d2f4-\+01d2ff' ||
    U&'\+01d357-\+01d35f\+01d379-\+01d3ff\+01d455\+01d49d\+01d4a0-\+01d4a1' ||
    U&'\+01d4a3-\+01d4a4\+01d4a7-\+01d4a8\+01d4ad\+01d4ba\+01d4bc\+01d4c4' ||
    U&'\+01d506\+01d50b-\+01d50c\+01d515\+01d51d\+01d53a\+01d53f\+01d545' ||
    U&'\+01d547-\+01d549\+01d551\+01d6a6-\+01d6a7\+01d7cc-\+01d7cd' ||
    U&'\+01da8c-\+01da9a\+01daa0\+01dab0-\+01deff\+01df1f-\+01df24' ||
    U&'\+01df2b-\+01dfff\+01e007\+01e019-\+01e01a\+01e022\+01e025' ||
    U&'\+01e02b-\+01e02f\+01e06e-\+01e08e\+01e090-\+01e0ff\+01e12d-\+01e12f' ||
    U&'\+01e13e-\+01e13f\+01e14a-\+01e14d\+01e150-\+01e28f\+01e2af-\+01e2bf' ||
    U&'\+01e2fa-\+01e2fe\+01e300-\+01e4cf\+01e4fa-\+01e5cf\+01e5fb-\+01e5fe' ||
    U&'\+01e600-\+01e6bf\+01e6df\+01e6f6-\+01e6fd\+01e700-\+01e7df\+01e7e7' ||
    U&'\+01e7ec\+01e7ef\+01e7ff\+01e8c5-\+01e8c6\+01e8d7-\+01e8ff' ||
    U&'\+01e94c-\+01e94f\+01e95a-\+01e95d\+01e960-\+01ec70\+01ecb5-\+01ed00' ||
    U&'\+01ed3e-\+01edff\+01ee04\+01ee20\+01ee23\+01ee25-\+01ee26\+01ee28' ||
    U&'\+01ee33\+01ee38\+01ee3a\+01ee3c-\+01ee41\+01ee43-\+01ee46\+01ee48' ||
    U&'\+01ee4a\+01ee4c\+01ee50\+01ee53\+01ee55-\+01ee56\+01ee58\+01ee5a' ||
    U&'\+01ee5c\+01ee5e\+01ee60\+01ee63\+01ee65-\+01ee66\+01ee6b\+01ee73' ||
    U&'\+01ee78\+01ee7d\+01ee7f\+01ee8a\+01ee9c-\+01eea0\+01eea4\+01eeaa' ||
    U&'\+01eebc-\+01eeef\+01eef2-\+01efff\+01f02c-\+01f02f\+01f094-\+01f09f' ||
    U&'\+01f0af-\+01f0b0\+01f0c0\+01f0d0\+01f0f6-\+01f0ff\+01f1ae-\+01f1e5' ||
    U&'\+01f203-\+01f20f\+01f23c-\+01f23f\+01f249-\+01f24f\+01f252-\+01f25f' ||
    U&'\+01f266-\+01f2ff\+01f6d9-\+01f6db\+01f6ed-\+01f6ef\+01f6fd-\+01f6ff' ||
    U&'\+01f7da-\+01f7df\+01f7ec-\+01f7ef\+01f7f1-\+01f7ff\+01f80c-\+01f80f' ||
    U&'\+01f848-\+01f84f\+01f85a-\+01f85f\+01f888-\+01f88f\+01f8ae-\+01f8af' ||
    U&'\+01f8bc-\+01f8bf\+01f8c2-\+01f8cf\+01f8d9-\+01f8ff\+01fa58-\+01fa5f' ||
    U&'\+01fa6e-\+01fa6f\+01fa7d-\+01fa7f\+01fa8b-\+01fa8d\+01fac7' ||
    U&'\+01fac9-\+01facc\+01fadd-\+01fade\+01faeb-\+01faee\+01faf9-\+01faff' ||
    U&'\+01fb93\+01fbfb-\+01ffff\+02a6e0-\+02a6ff\+02b81e-\+02b81f' ||
    U&'\+02ceae-\+02ceaf\+02ebe1-\+02ebef\+02ee5e-\+02f7ff\+02fa1e-\+02ffff' ||
    U&'\+03134b-\+03134f\+03347a-\+0e00ff\+0e01f0-\+10ffff]');
begin
  if kind is null then return value = ''; end if;
  if kind = 'lucide' then
    return value = any(array['carrot','beef','milk','pizza','cup-soda',
      'flask-round','soap-dispenser-droplet','heart-pulse','tag']);
  end if;
  if kind <> 'text' or value is null or value = '' or value ~ hidden then return false; end if;
  -- UAX #29 extended grapheme boundaries; C/Z characters are already excluded.
  foreach current_character in array regexp_split_to_array(normalize(value, NFC), '') loop
    code := ascii(current_character);
    current_kind := case
      when code = 8205 then 'ZWJ'
      when current_character ~ extend_chars then 'Extend'
      when current_character ~ spacing_marks then 'SpacingMark'
      when current_character ~ prepend_chars then 'Prepend'
      when current_character ~ hangul_l then 'L'
      when current_character ~ hangul_v then 'V'
      when current_character ~ hangul_t then 'T'
      when code between 44032 and 55203 then case when (code - 44032) % 28 = 0 then 'LV' else 'LVT' end
      when code between 127462 and 127487 then 'RI'
      else 'Other' end;
    if previous_kind is not null and not (
      current_kind in ('Extend', 'ZWJ', 'SpacingMark')
      or previous_kind = 'Prepend'
      or (previous_kind = 'L' and current_kind in ('L', 'V', 'LV', 'LVT'))
      or (previous_kind in ('LV', 'V') and current_kind in ('V', 'T'))
      or (previous_kind in ('LVT', 'T') and current_kind = 'T')
      or (current_character ~ consonants and conjunct_start and conjunct_link)
      or (previous_kind = 'ZWJ' and joined_emoji and current_character ~ emoji)
      or (previous_kind = 'RI' and current_kind = 'RI' and regional_count % 2 = 1)
    ) then return false; end if;
    if code <> 8205 and current_character !~ marks then has_visible := true; end if;
    if current_character ~ consonants then
      conjunct_start := true;
      conjunct_link := false;
    elsif current_character ~ linkers then
      conjunct_link := conjunct_start;
    elsif current_character !~ conjunct_extend then
      conjunct_start := false;
      conjunct_link := false;
    end if;
    if current_kind = 'ZWJ' then
      joined_emoji := emoji_prefix;
      emoji_prefix := false;
    elsif current_kind = 'Extend' then
      joined_emoji := false;
    else
      joined_emoji := false;
      emoji_prefix := current_character ~ emoji;
    end if;
    regional_count := case when current_kind = 'RI' then regional_count + 1 else 0 end;
    previous_kind := current_kind;
  end loop;
  return has_visible;
end;
$$;
revoke all on function private.inventory_icon_valid(text, text) from public, anon, authenticated;

alter table public.families add column expiry_days integer not null default 3 check (expiry_days between 0 and 30);
create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  sort_order integer not null default 0 check (sort_order >= 0),
  icon_kind text check (icon_kind in ('lucide', 'text')),
  icon_value text not null default '',
  check (private.inventory_icon_valid(icon_kind, icon_value)),
  unique (family_id, name), unique (id, family_id)
);
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (family_id, name), unique (id, family_id)
);
create table public.units (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (family_id, name), unique (id, family_id)
);
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  mode text not null default 'quantity' check (mode in ('quantity', 'status')),
  quantity numeric not null default 0
    check (quantity >= 0 and quantity <> 'NaN'::numeric and quantity < 'Infinity'::numeric),
  status text not null default 'enough' check (status in ('enough', 'low', 'none')),
  unit_id uuid, category_id uuid, location_id uuid,
  min_quantity numeric
    check (min_quantity >= 0 and min_quantity <> 'NaN'::numeric and min_quantity < 'Infinity'::numeric),
  expires_on date,
  check (mode <> 'quantity' or unit_id is not null),
  foreign key (unit_id, family_id) references public.units(id, family_id),
  foreign key (category_id, family_id) references public.inventory_categories(id, family_id),
  foreign key (location_id, family_id) references public.locations(id, family_id)
);
create index inventory_items_family_idx on public.inventory_items(family_id);
create index inventory_items_unit_idx on public.inventory_items(unit_id);
create index inventory_items_category_idx on public.inventory_items(category_id);
create index inventory_items_location_idx on public.inventory_items(location_id);
alter table public.inventory_items enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.locations enable row level security;
alter table public.units enable row level security;
revoke all on public.inventory_items, public.inventory_categories, public.locations, public.units
  from public, anon, authenticated;
grant select on public.inventory_items, public.inventory_categories, public.locations, public.units to authenticated;
create policy inventory_read_family on public.inventory_items for select to authenticated
  using (family_id = private.current_family_id());
create policy inventory_categories_read_family on public.inventory_categories for select to authenticated
  using (family_id = private.current_family_id());
create policy locations_read_family on public.locations for select to authenticated
  using (family_id = private.current_family_id());
create policy units_read_family on public.units for select to authenticated
  using (family_id = private.current_family_id());

create function private.seed_inventory_defaults(family uuid, kind text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if kind is null or kind = 'categories' then
    insert into public.inventory_categories(family_id, name, sort_order, icon_kind, icon_value)
      select family, name, ord::integer - 1, 'lucide', icon from
      unnest(array[
        '채소·과일','정육·수산','유제품·계란','가공식품','음료',
        '양념·소스','생활용품','건강·뷰티','기타'],
      array['carrot','beef','milk','pizza','cup-soda','flask-round','soap-dispenser-droplet','heart-pulse','tag'])
      with ordinality seed(name, icon, ord) on conflict (family_id, name)
      do update set sort_order = excluded.sort_order, icon_kind = excluded.icon_kind, icon_value = excluded.icon_value;
  end if;
  if kind is null or kind = 'locations' then
    insert into public.locations(family_id, name, sort_order)
      select family, name, ord::integer - 1 from
      unnest(array['냉장실','냉동실','실온 식품장·팬트리','욕실·세탁실','서랍·수납장'])
      with ordinality seed(name, ord) on conflict (family_id, name)
      do update set sort_order = excluded.sort_order;
  end if;
  if kind is null or kind = 'units' then
    insert into public.units(family_id, name, sort_order)
      select family, name, ord::integer - 1 from
      unnest(array['개','팩','병','봉지','캔','박스','롤','g','kg','ml','L'])
      with ordinality seed(name, ord) on conflict (family_id, name) do nothing;
  end if;
end;
$$;
create function private.seed_inventory_family() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_inventory_defaults(new.id);
  return new;
end;
$$;
create trigger seed_inventory_family after insert on public.families
  for each row execute function private.seed_inventory_family();
select private.seed_inventory_defaults(id) from public.families;
revoke all on function private.seed_inventory_defaults(uuid, text), private.seed_inventory_family()
  from public, anon, authenticated;

-- One family lock also serializes list deletion, adjustments and merges.
create function public.write_inventory(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  target uuid := (payload->>'id')::uuid;
  action text := payload->>'action';
  item jsonb := payload->'item';
  saved uuid;
  current_item public.inventory_items;
  delta numeric;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if target is not null then
    select * into current_item from public.inventory_items where id = target and family_id = family for update;
    if not found then raise exception 'inventory_not_found'; end if;
  end if;
  if action = 'delete' and target is not null then
    delete from public.inventory_items where id = target and family_id = family;
  elsif action = 'used-up' and target is not null then
    update public.inventory_items set quantity = case when mode = 'quantity' then 0 else quantity end,
      status = case when mode = 'status' then 'none' else status end where id = target and family_id = family;
  elsif action = 'status' and target is not null then
    if current_item.mode <> 'status' or payload->>'status' is null
      or payload->>'status' not in ('enough', 'low', 'none') then raise exception 'invalid_inventory'; end if;
    update public.inventory_items set status = payload->>'status' where id = target and family_id = family;
  elsif action in ('adjust', 'merge') and target is not null then
    if current_item.mode <> 'quantity' then raise exception 'quantity_required'; end if;
    delta := (payload->>'delta')::numeric;
    if delta is null or delta = 'NaN'::numeric or abs(delta) = 'Infinity'::numeric or
      (action = 'merge' and delta < 0) then raise exception 'invalid_inventory'; end if;
    update public.inventory_items set quantity = greatest(0, quantity + delta) where id = target and family_id = family;
  elsif action = 'save' and item is not null then
    if item->>'name' is null or char_length(btrim(item->>'name')) not between 1 and 100 then
      raise exception 'invalid_inventory';
    end if;
    if (item->>'unit_id') is not null and not exists(
      select 1 from public.units where id = (item->>'unit_id')::uuid and family_id = family)
      then raise exception 'invalid_inventory'; end if;
    if (item->>'category_id') is not null and not exists(
      select 1 from public.inventory_categories where id = (item->>'category_id')::uuid and family_id = family)
      then raise exception 'invalid_inventory'; end if;
    if (item->>'location_id') is not null and not exists(
      select 1 from public.locations where id = (item->>'location_id')::uuid and family_id = family
        and (enabled or id = current_item.location_id))
      then raise exception 'invalid_inventory'; end if;
    saved := coalesce(target, gen_random_uuid());
    insert into public.inventory_items(
      id, family_id, name, mode, quantity, status, unit_id, category_id, location_id, min_quantity, expires_on
    )
      values (saved, family, btrim(item->>'name'), item->>'mode',
        case when item->>'mode' = 'status' then 0 else (item->>'quantity')::numeric end,
        case when item->>'mode' = 'quantity' then 'enough' else item->>'status' end,
        case when item->>'mode' = 'status' then null else (item->>'unit_id')::uuid end,
        (item->>'category_id')::uuid, (item->>'location_id')::uuid,
        case when item->>'mode' = 'status' then null else (item->>'min_quantity')::numeric end,
        (item->>'expires_on')::date)
      on conflict (id) do update set name = excluded.name, mode = excluded.mode, quantity = excluded.quantity,
        status = excluded.status, unit_id = excluded.unit_id, category_id = excluded.category_id,
        location_id = excluded.location_id, min_quantity = excluded.min_quantity, expires_on = excluded.expires_on;
    return saved;
  else raise exception 'invalid_inventory';
  end if;
  return target;
end;
$$;

create function public.write_inventory_meta(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  family uuid := private.current_family_id();
  kind text := payload->>'kind';
  action text := payload->>'action';
  target uuid := (payload->>'id')::uuid;
  entry jsonb := payload->'entry';
  table_name text;
  affected integer;
  other_category uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if family is null then raise exception 'family_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 6));
  if action = 'expiry' then
    if payload->>'days' is null or (payload->>'days')::numeric not between 0 and 30
      or (payload->>'days')::numeric <> trunc((payload->>'days')::numeric) then
      raise exception 'invalid_inventory';
    end if;
    update public.families set expiry_days = (payload->>'days')::integer where id = family;
    return;
  end if;
  table_name := case kind when 'categories' then 'inventory_categories'
    when 'locations' then 'locations' when 'units' then 'units' else null end;
  if table_name is null then raise exception 'invalid_inventory'; end if;
  if target is not null then
    execute format('select 1 from public.%I where id = $1 and family_id = $2', table_name) using target, family;
    get diagnostics affected = row_count;
    if affected = 0 then raise exception 'inventory_not_found'; end if;
  end if;
  if action = 'delete' and target is not null then
    if kind = 'units' and exists(
      select 1 from public.inventory_items where unit_id = target and family_id = family)
      then raise exception 'unit_in_use'; end if;
    if kind = 'categories' then
      if exists(select 1 from public.inventory_categories where id = target and name = '기타')
        then raise exception 'invalid_inventory'; end if;
      insert into public.inventory_categories(family_id, name, sort_order, icon_kind, icon_value)
        values(family, '기타', 8, 'lucide', 'tag') on conflict (family_id, name) do nothing;
      select id into other_category from public.inventory_categories where family_id = family and name = '기타';
      update public.inventory_items set category_id = other_category where category_id = target and family_id = family;
    end if;
    if kind = 'locations' then
      update public.inventory_items set location_id = null where location_id = target and family_id = family;
    end if;
    execute format('delete from public.%I where id = $1 and family_id = $2', table_name) using target, family;
  elsif action = 'reset' then
    perform private.seed_inventory_defaults(family, kind);
    if kind = 'categories' then
      select id into other_category from public.inventory_categories where family_id = family and name = '기타';
      update public.inventory_items i set category_id = other_category
        where i.family_id = family and i.category_id in (
          select id from public.inventory_categories where family_id = family and name <> all(array[
            '채소·과일','정육·수산','유제품·계란','가공식품','음료',
            '양념·소스','생활용품','건강·뷰티','기타']));
      delete from public.inventory_categories where family_id = family and name <> all(array[
        '채소·과일','정육·수산','유제품·계란','가공식품','음료',
        '양념·소스','생활용품','건강·뷰티','기타']);
    elsif kind = 'locations' then
      update public.locations set enabled = true where family_id = family;
    else
      delete from public.units u where u.family_id = family
        and u.name <> all(array['개','팩','병','봉지','캔','박스','롤','g','kg','ml','L'])
        and not exists(select 1 from public.inventory_items i where i.unit_id = u.id);
    end if;
  elsif action = 'save' and entry is not null then
    if entry->>'name' is null or char_length(btrim(entry->>'name')) not between 1 and 30 then
      raise exception 'invalid_inventory';
    end if;
    if kind = 'categories' and not private.inventory_icon_valid(entry->>'icon_kind', coalesce(entry->>'icon_value', ''))
      then raise exception 'invalid_inventory'; end if;
    target := coalesce(target, gen_random_uuid());
    if kind = 'categories' then
      insert into public.inventory_categories(id, family_id, name, sort_order, icon_kind, icon_value)
        values(target, family, btrim(entry->>'name'), (entry->>'sort_order')::integer,
          entry->>'icon_kind', coalesce(entry->>'icon_value', ''))
        on conflict(id) do update set name = excluded.name, sort_order = excluded.sort_order,
          icon_kind = excluded.icon_kind, icon_value = excluded.icon_value;
    elsif kind = 'locations' then
      insert into public.locations(id, family_id, name, sort_order, enabled)
        values(target, family, btrim(entry->>'name'), (entry->>'sort_order')::integer, (entry->>'enabled')::boolean)
        on conflict(id) do update set name = excluded.name, sort_order = excluded.sort_order,
          enabled = excluded.enabled;
    else
      insert into public.units(id, family_id, name, sort_order)
        values(target, family, btrim(entry->>'name'), (entry->>'sort_order')::integer)
        on conflict(id) do update set name = excluded.name, sort_order = excluded.sort_order;
    end if;
  else raise exception 'invalid_inventory';
  end if;
exception when unique_violation then raise exception 'inventory_meta_duplicate';
end;
$$;
revoke all on function public.write_inventory(jsonb), public.write_inventory_meta(jsonb)
  from public, anon, authenticated;
grant execute on function public.write_inventory(jsonb), public.write_inventory_meta(jsonb) to authenticated;
