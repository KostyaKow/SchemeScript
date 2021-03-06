var scomp = require('./selfcomp.js');
cons = scomp.cons;
cdr = scomp.cdr;
arr_to_lst = scomp.arr_to_lst;
lst_to_arr = scomp.lst_to_arr;
cons_map = scomp.cons_map;

/*function conf() {
   //( ) { } [ ] ' , "

   //o_paren, c_paren, o_square_br, c_square_br
   //var lexemeTypes = ['sym', 'num', 'str', 'paren', 'quote', 'comment'];
   //this.lexemeTypes = lexemeTypes;
   return this;
}

var c = conf();*/
function ss_get_val(x) { //TODO: check for other stuff like pair
   if (x.ss_type != undefined && x.ss_type != SS_ERR)
      return x.value;
   return null;
}
function ss_mk_var(type, val) {
   var v = {};
   v.ss_type = type;
   if (val != undefined)
      v.value = val;
   return v;
}
function ss_mk_err(code, stage, start, end) {
   var err = ss_mk_var(SS_ERR); //look at Error types
   err.stage = stage; //lex/parse
   err.code = code;
   err.start = start;
   err.end = end;
   return err;
}
function ss_is_type(val, t) {
   if (typeof val === 'object' && val.ss_type != undefined) {
      return val.ss_type == t;
   }
   return null;
}

//Error types
var SS_ERR_NoStartParen = "Missing Open Parenthesis";
var SS_ERR_BadLexeme = "Bad Lexeme";
var SS_ERR_NoEndParen = "Missing Close Parenthesis";
var SS_ERR_UnterminatedComment = "Unterminated Comment"; //-42;
var SS_ERR_UnterminatedQuote = "Unterminated Quote"; //-41;
var SS_ERR_MisformedNum = "Misformed Number"; //-40;
var SS_ERR_UnknownLexBlock = "Unknown Lexeme Block"; //-39;
var SS_ERR_UncompleteExp = "Uncomplete Expression";

//variable types
var SS_LEX = 'ss_lex';
var SS_STR = 'ss_str';
//var SS_NUM = 'ss_num';
var SS_INT = 'ss_int';
var SS_FLT = 'ss_flt'; //float
var SS_SYM = 'ss_sym';
var SS_NIL = 'ss_nil';
var SS_CCC = 'ss_cc';
//var SS_FUN = 'ss_fun';
var SS_ERR = 'ss_err';
//var SS_LST = 'ss_lst';
var SS_ARR = 'ss_arr';
var SS_CON = 'ss_con';
var SS_Q   = 'ss_\'';  // '
var SS_QQ  = 'ss_`';   // ` (quasiquote/backquote)
var SS_CMA = 'ss_,';   // , (comma)

//LEXER STUFF

//internal lexer function
//Block is a lexeme type which stores parts of
//code that don't get parsed but just get stored
//as a string. Currently, blocks include strings
//and single & multi-line comments.
//Note: parenthesis don't count as blocks
function _lex_get_block_ranges(str) {
   //blk type = 'str'|';'|'#|'
   function mk_blk(type, start, end) {
      var ret = {};
      ret.start = start;
      ret.end = end;
      ret.type = type;
      return ret;
   }

   var blk_ranges = [];

   var cmnt_start = null;
   var str_start = null;

   var multi_first_char = false; //multiline comment
   var escape = false;

   //index in str where current line starts (which is length of previous line)
   var line_start = 0;
   var lines = str.split('\n');

   for (var lineNum in lines) {
      var line = lines[lineNum];
      var line_end = line_start + line.length + 1;

      for (var i = 0; i < line.length; i++) {
         var c = line[i];
         var real_i = line_start + i; //index into str of current char

         if (escape) { escape = false; continue; }

         if (c == '\\' && str_start != null) {
            escape = true;
         }
         else if (c == '"' && cmnt_start == null) {
            if (str_start == null)
               str_start = real_i;
            else {
               blk_ranges.push(mk_blk('str', str_start, real_i));
               str_start = null;
            }
         }
         else if (c == ';' && cmnt_start == null && str_start == null) {
            blk_ranges.push(mk_blk(';', real_i, line_end));
            break; //go to next line
         }
         else if (c == '|' && str_start == null) {
            if (cmnt_start == null && multi_first_char) {
               cmnt_start = real_i-1;
            } else {
               multi_first_char = true;
               continue;
            }
         }
         else if (c == '#' && str_start == null) {
            if (cmnt_start == null) { //if no multiline comment
               multi_first_char = true;
               continue;
            }
            else if (multi_first_char) { //if multi already began
               blk_ranges.push(mk_blk('#|', cmnt_start, real_i));
               cmnt_start = null;
            }
         }

         multi_first_char = false;
      }

      line_start = line_end;
   }

   if (cmnt_start != null)
      return ss_mk_err(SS_ERR_UnterminatedComment, 'lex', cmnt_start, str.length - 1);
   if (str_start != null)
      return ss_mk_err(SS_ERR_UnterminatedQuote, 'lex', str_start, str.length - 1);
   return ss_mk_var(SS_ARR, blk_ranges);
}

//Lexeme types
var SS_LEX_STR = 'ss_lex_str';
var SS_LEX_INT = 'ss_lex_int';
var SS_LEX_FLT = 'ss_lex_flt'; //float
var SS_LEX_SYM = 'ss_lex_sym';
var SS_LEX_O_P = 'ss_lex_o_p'; // (
var SS_LEX_C_P = 'ss_lex_c_p'; // )
var SS_LEX_O_S = 'ss_lex_o_s'; // [
var SS_LEX_C_S = 'ss_lex_c_s'; // ] close square
var SS_LEX_O_C = 'ss_lex_o_c'; // { open curly
var SS_LEX_C_C = 'ss_lex_c_c'; // } close curvy
/*var SS_LEX_Q   = 'ss_lex_q'; // '
var SS_LEX_QQ  = 'ss_lex_qq';  // ` (quasiquote/backquote)
var SS_LEX_CMA = 'ss_lex_cma'; // , (comma)*/
var SS_LEX_Q   = 'ss_lex_\'';  // '
var SS_LEX_QQ  = 'ss_lex_`';   // ` (quasiquote/backquote)
var SS_LEX_CMA = 'ss_lex_,';   // , (comma)
var SS_LEX_SC  = 'ss_lex_sc';  // ; (simple comment that spawns until end of line)
var SS_LEX_BC  = 'ss_lex_bc';  // #| and |# (block comment)

function make_lexeme(type, val) {
   return ss_mk_var(SS_LEX, {'type':type, 'value':val});
}
function make_lexeme_range(type, val, start, end) {
   return {'lexeme': make_lexeme(type, val), 'start': start, 'end': end};
}
function add_lex_range(lex, start, end) {
   return {'lexeme': lex, 'start': start, 'end': end};
}

function collect_sym(col) {
   if (is_int(col))
      return make_lexeme(SS_LEX_INT, parseInt(col));
   if (is_float(col))
      return make_lexeme(SS_LEX_FLT, parseFloat(col));
   if (is_number_like(col)) // 2dsfsd 4dsf is not allowed
      return null;
   return make_lexeme(SS_LEX_SYM, col);
}

//err or array
function lex(str) {
   console.log('lexing str'); //: ' + str);
   var lexemes = [];
   var col = ''; //symbol collector

   //range of comments/string blocks
   var block_ranges_ret = _lex_get_block_ranges(str);
   if (ss_is_type(block_ranges_ret, SS_ERR)) return block_ranges_ret;

   var block_ranges = ss_get_val(block_ranges_ret);
   var br_it = 0; //current string/comment range
   var i = 0;
   var collect_start = 0, collect_end = 0;

   while (i < str.length) {
      //var is_block_start = br_it < block_ranges.length && block_ranges[br_it].start == i;

      //block != null if haven't looped through all blocks, and i is beginning of block
      var block = br_it < block_ranges.length ? block_ranges[br_it] : null;
      block = (block != null && block.start == i) ? block : null;

      //if current char c is string or special char, then push previously collected
      var c = str[i];
      var special_chars = [' ', '(', ')', '\'', '`', ',', '[', ']', '{', '}'];
      var is_c_special = (block != null) || contains(special_chars, c);

      //current is special, so push previously collected numberes and symbols
      if (is_c_special && !(col.length == 0)) {
         var lexeme = collect_sym(col);
         if (lexeme == null)
            return ss_mk_err(SS_ERR_MisformedNum, 'lex', collect_start, collect_end);
         else
            lexemes.push(add_lex_range(lexeme, collect_start, collect_end));
         col = '';
      }
      if (block != null) { //push strings and comments if we have any
         var block_lexeme = null;

         switch (block.type) { //'str' or ';' or '#|'
            case 'str':
               var slice = str.slice(block.start+1, block.end-1+1);
               block_lexeme = make_lexeme(SS_LEX_STR, slice);
            break;
            case '#|':
               var slice = str.slice(block.start+2, block.end-2+1); //block.end-2+1+1
               block_lexeme = make_lexeme(SS_LEX_BC, slice);
            break;
            case ';':
               var slice = str.slice(block.start+1, block.end-1); //block.end-1+1
               block_lexeme = make_lexeme(SS_LEX_SC, slice);
            break;
         }

         if (block_lexeme == null)
            return ss_mk_err(SS_ERR_UnknownLexBlock, 'lex', block.start, block.end);
         lexemes.push(add_lex_range(block_lexeme, block.start, block.end));
         i = block.end //+ 1; //TODO: maybe continue
         //if (block.type == '#|') i += 1; //TODO: why does this work?
         br_it += 1; //next block range
      }
      if (str[i] != undefined) {
         c = str[i];
         if (contains([',', '`', '\'', '(', ')', '[', ']', '{', '}'], c)) {
            var lex_type = null;

            if (c == ',' || c == '`' || c == '\'') lex_type = 'ss_lex_' + c;
            else if (c == '(') lex_type = SS_LEX_O_P;
            else if (c == ')') lex_type = SS_LEX_C_P;
            else if (c == '[') lex_type = SS_LEX_O_S;
            else if (c == ']') lex_type = SS_LEX_C_S;
            else if (c == '{') lex_type = SS_LEX_O_C;
            else if (c == '}') lex_type = SS_LEX_C_C;

            lexemes.push(make_lexeme_range(lex_type, null, i, i));
         }
         /*else if (c == '"' || c == '#' || c == ';') //gets triggered for stuff like """"
            i -= 1; //TODO: why do we have to do this?*/
         //else if (c == '#')
         else if (c == '"' || c == '#' /*|| c == ';'*/) ;
         else if (c == ';') continue;
         else if (c == ' ' || c == '\n') ; //skip
         else {
            if (col.length == 0) {
               collect_start = i;
               collect_end = i;
            }
            else collect_end = i;
            //col.push(c);
            col += c;
         }
      }
      i += 1;
   }

   if (col.length > 0) {
      var l = collect_sym(col);
      if (l != null)
         lexemes.push(add_lex_range(l, collect_start, collect_end));
      else //TODO: test last part of string with misformed number
         return ss_mk_err(SS_ERR_MisformedNum, 'lex', collect_start, collect_end);
   }
   return ss_mk_var(SS_ARR, lexemes);
}

function test_lex_get_block_ranges() {
   //TODO: test each block type as beginning/end of line/file for each one
   var test_str1 = "\"hello ;world\";test\n f #|yo|#"; //one string, 1 1-line comment, 1 multi-line
   var test_str2 = "\"\"\"\" ;\n\n #||##|\n|#"; //2 strings, 2 1-line comments, 2 multi-line comments
   var test_str3 = "\"h#| |#ello ;\"blah;test\nf#|y;o|#"; //1 string, 1 1-line, 1 multi-line
   var test_str4 = "\"h#| |#ello ;\"\"world\";test\nf#|y;\no|#"; //
   var test_str5 = "#|ha|##|ho|#";
   var test_str6 = 'yo "hi"';
   var test_str6 = 'yo #| ha\nblah|#';

   console.log(_lex_get_block_ranges(test_str4));
}

function _print_lex_result(lex_res) {
   if (ss_is_type(lex_res, SS_ERR))
      console.log("bad lex() (" + lex_res.start + ", " +
                  lex_res.end + "): " + lex_res.code);
   var lexemes = ss_get_val(lex_res);

   for (var i in lexemes) {
      var lexeme = lexemes[i];
      console.log('start: ' + lexeme.start + ' end: ' + lexeme.end +
                  ' data: ' + JSON.stringify(lexeme.lexeme.value));
   }
}

function test_lex() {
   //TODO: test last part of string with bad number like "(hi 34a"
   var test_lex_str1 = "(+ 3 5)";
   var test_lex_str2 = "32ff"; //should get "Misformed Number"
   var test_lex_str3 = '(+ "yo" ho ho)';
   var test_lex_str4 = '(()h   )';
   var test_lex_str5 = 'ha"blah"';
   var test_lex_str6 = '"fa"';
   var test_lex_str7 = '"ba""ga"';
   var test_lex_str8 = 'lo"la"ba "ha"';
   var test_lex_str9 = '"fa" "'; //"Unterminated Quote"
   var test_lex_str10 = '(+ 3 5)) ;world haha"\n4.5';
   var test_lex_str11 = '(+ 3 5)) #|;world haha"\n4.5|#3.5';
   var test_lex_str12 = '#|ha|##|ba|#';
   var test_lex_str13 = '#|ha|#';

   //console.log(_lex_get_block_ranges(test_lex_str11));
   //console.log(lex(test_lex_str1));
   _print_lex_result(lex(test_lex_str7));
}
//END LEXER STUFF

//PARSER STUFF
//parser itself (no testing code)
function lexer_quote_to_exp(q) {
   if (q == SS_LEX_Q) return SS_Q;
   if (q == SS_LEX_QQ) return SS_QQ;
   if (q == SS_LEX_CMA) return SS_CMA;
   return null;
}

//returns err or dict {start:range_start, end:range_end, quotes:q, atom?:is_atom}
function _parser_get_child_ranges(lexemes, start, end) {
   function make_range(start, end, quotes, is_atom) {
      return { 'start': start, 'end': end, 'quotes': quotes, 'atom?': is_atom };
   }

   var nestedness = 0;
   var child_ranges = [];
   var quotes = [];
   var child_start = null;
   var i = start;

   while (i <= end) {
      var l_data = lexemes[i]; //l_data.start, l_data.end, l_data.lexeme
      var lexeme = l_data.lexeme.value;
      //console.log(lexeme);

      if (lexeme.type == SS_LEX_O_P) {
         nestedness += 1;
         if (nestedness == 1) child_start = i;
      }
      else if (lexeme.type == SS_LEX_C_P) {
         nestedness -= 1;
         if (nestedness == 0) {
            child_ranges.push(make_range(child_start, i, quotes, false));
            quotes = [];
            child_start = null;
         }
         else if (nestedness < 0)
            return ss_mk_err(SS_ERR_NoStartParen, 'parse', end, end);
      }
      else if (contains([SS_LEX_Q, SS_LEX_QQ, SS_LEX_CMA], lexeme.type)) {
         if (nestedness == 0) quotes.push(lexeme.type);
      }
      else if (nestedness == 0) {
         child_ranges.push(make_range(i, i, quotes, true));
         quotes = [];
      }
      i++;
   }

   if (nestedness > 0)
      return ss_mk_err(SS_ERR_NoEndParen, 'parse', child_start, end);
   return ss_mk_var(SS_ARR, child_ranges);
}

function _parse_lexeme(lex) {
   var l = lex.lexeme.value;
   //console.log('parsing lexeme: ' + JSON.stringify(l));
   if (l.type == SS_LEX_STR) return ss_mk_var(SS_STR, l.value);
   if (l.type == SS_LEX_SYM) return ss_mk_var(SS_SYM, l.value);
   if (l.type == SS_LEX_INT) return ss_mk_var(SS_INT, l.value);
   if (l.type == SS_LEX_FLT) return ss_mk_var(SS_FLT, l.value);
   return null;
}

function _parse_helper(lexemes, start, end, quotes, is_atom) {
   var quotes = quotes.reverse();
   if (is_atom) {
      var l = lexemes[start];
      let exp = _parse_lexeme(l);
      if (exp == null) {
         //console.log(lexemes[start]);
         var t = l.lexeme.value.type;
         if (t == SS_LEX_SC || t == SS_LEX_BC) {
            //console.log('............');
            return ss_mk_var(SS_CCC, null);
         }
         return ss_mk_err(SS_ERR_BadLexeme, 'parse', start, end);
      }
      for (var i in quotes) { //TODO: reverse quotes???
         exp = ss_mk_var(lexer_quote_to_exp(quotes[i]), exp);
      }
      return exp;
   }

   var sub = []; //kk removeme //ss_mk_var(SS_NIL); //[];

   var child_ranges_ret = _parser_get_child_ranges(lexemes, start, end);
   if (ss_is_type(child_ranges_ret, SS_ERR))
      return child_ranges_ret;
   var child_ranges = ss_get_val(child_ranges_ret);

   var c_it = 0; //current child range
   var i = start;

   while (i <= end) {
      var is_child_start = c_it < child_ranges.length && child_ranges[c_it].start == i;

      if (is_child_start) {
         var child = child_ranges[c_it];
         var c_start = child.start;
         var c_end = child.end;

         if (!child['atom?']) {
            c_start += 1; c_end -= 1;
         }
         var parsed_child_ret = _parse_helper(lexemes, c_start, c_end,
                                             child.quotes, child['atom?']);
         if (ss_is_type(parsed_child_ret, SS_ERR))
            return parsed_child_ret;
         else if (!ss_is_type(parsed_child_ret, SS_CCC))
            sub.push(parsed_child_ret); //kk remove tags //ss_get_val(parsed_child_ret));
         //kk removeme //sub = cons(ss_get_val(parsed_child_ret), sub); //TODO: reverse?

         c_it += 1;
         i = c_end + 1;
         continue;
      }
      i += 1;
   }

   //kk removeme
   //var ret = arr_to_lst(lst_to_arr(sub).reverse());
   var ret = ss_mk_var(SS_ARR, sub);

   /*for (var i = quotes.length-1; i > 0; i--) //TODO: reverse quotes?
      ret = ss_mk_var(lexer_quote_to_exp(quotes[i]), ret);*/
   for (var i = 0; i < quotes.length; i++) //TODO: reverse quotes?
      ret = ss_mk_var(lexer_quote_to_exp(quotes[i]), ret);
   return ret;
}

function parse(lexemes) {
   if (lexemes.length == 0)
      return ss_mk_err(SS_ERR_UncompleteExp, 'parse', 0, 0);

   var child_ranges_ret = _parser_get_child_ranges(lexemes, 0, lexemes.length-1);
   //print_child_range_res(child_ranges_ret);

   if (ss_is_type(child_ranges_ret, SS_ERR))
      return child_ranges_ret;
   var child_ranges = ss_get_val(child_ranges_ret);

   var ret = []; //ss_mk_var(SS_NIL);

   for (var child_i in child_ranges) {
      var child_range = child_ranges[child_i];
      var start = child_range.start;
      var end = child_range.end;
      var quotes = child_range.quotes;
      var is_atom = child_range['atom?'];

      if (!is_atom) {
         start += 1;
         end -= 1;
      }

      var parsed_child_ret = _parse_helper(lexemes, start, end, quotes, is_atom);
      if (ss_is_type(parsed_child_ret, SS_ERR))
         return parsed_child_ret;
      if (!ss_is_type(parsed_child_ret, SS_CCC))
         ret.push(parsed_child_ret); //ss_get_val(parsed_child_ret));
      //ret = cons(ss_get_val(parsed_child_ret), ret);
   }
   ret = ss_mk_var(SS_ARR, ret);
   //ret = arr_to_lst(lst_to_arr(ret).reverse());
   return ret; //ss_mk_var(SS_CON, ret);
}

function print_child_range_res(range_res) {
   if (ss_is_type(range_res, SS_ERR)) {
      console.log("bad get_child_ranges(): (" + range_res.start + ', ' +
                  range_res.end + '): ' + range_res.code);
      return;
   }

   var child_ranges = ss_get_val(range_res);
   for (var i in child_ranges) {
      var cran = child_ranges[i];
      console.log('start: ' + cran.start + ', end: ' + cran.end +
                  ', atom?: ' + cran['atom?'] + ' \nquotes: ' +
                  JSON.stringify(cran.quotes));
   }
}

function print_exp_raw(e) {
   if (ss_is_type(e, SS_ERR)) {
      console.log("bad parse(): (" + e.start + ', ' +
                  e.end + '): ' + e.code);
      return;
   }
   console.log(JSON.stringify(e));
}

var s = require('./sprintf.js').sprintf;

function badResultPrint(debug_info, err, tab_chars) {
   /*console.log(tab_chars + "bad parse(): (" + err.start + ', ' +
               err.end + '): ' + err.code);
   var x = s("%ibad parse(): (%i, %i): %s",
             tab_chars, err.start, err.end, err.code));*/
   //console.log(s("%ibad parse(): (%i, %i): %s", tab_chars, err.start, err.end, err.code));
   //return;

   var err_while_err_str = 'error while displaying error: ';
   var char_i_start = null, char_i_end = null;

   if (!('origin_src' in debug_info)) {
      console.log(err_while_err_str + 'no source code origin');
      return;
   }

   if (err.stage == 'lex') {
      char_i_start = err.start;
      char_i_end = err.end;
   }
   else if (err.stage == 'parse') {
      //need to convert lexeme index into char index for display
      if (!('lexeme_indices' in debug_info)) {
         console.log(err_while_err_str + 'parse error but no lexeme indices');
         return;
      }
      var lexemes = debug_info.lexeme_indices;
      var lex_start = lexemes[err.start];
      console.log('first lexeme: ' + JSON.stringify(lex_start));
      var lex_end = lexemes[err.end];
      char_i_start = lex_start.start;
      char_i_end = lex_end.end;
   }
   else {
      s('%s unknown stage: (err: %s debug_info: %s)',
        err_while_err_str, String(err), String(debug_info));
   }

   if (!char_i_start || !char_i_end) {
      console.log(err_while_err_str + 'no character index for the error');
      return;
   }

   var origin = debug_info.origin_src;
   var lines = origin.split('\n');

   var start_line = null;
   var end_line = null;
   var start_char_in_line = null;
   var end_char_in_line = null;

   var curr_char_in_line = 0;
   var curr_line = 0;
   for (var i = 0; i < origin.length; i++) {
      var c = origin[i];
      if (c == '\n') {
         curr_line++;
         curr_char_in_line = 0;
      }
      if (i == char_i_start) {
         start_line = curr_line;
         start_char_in_line = curr_char_in_line;
      }
      if (i == char_i_end) {
         end_line = curr_line;
         end_char_in_line = curr_char_in_line;
      }
      curr_char_in_line++;
   }

   if (contains([start_line, end_line, start_char_in_line, end_char_in_line], null)) {
      console.log('error figuring out line stuff');
      return;
   }

   var err_str = s("%serror while %sing(): (%i, %i): %s\n",
                   tab_chars, err.stage, err.start, err.end, err.code);

   err_str += s('%sline:char (%i:%i, %i:%i)\n',
                tab_chars, start_line, start_char_in_line, end_line, end_char_in_line);

   for (var i = start_line; i <= end_line; i++) {
      if (lines[i].length == 0) continue;
      err_str += '\n' + lines[i] + '\n';

      for (var j in lines[i]) {
         var print = true;

         if (i == start_line && j < start_char_in_line)
            print = false;
         if (i == end_line && j > end_char_in_line)
            print = false;

         if (print)
            err_str += '^';
         else
            err_str += ' ';
      }
   }
   console.log(err_str);
}

/*debug_info = {
   'origin_src' : . //input source code (for lexer and parser)
   'lexeme_indices' : ., //array of lexemes with indices in source code (generated by lexer, used by parser) (look at add_lex_range)
}*/
//print_exp(lexed_opt/parsed_opt, SS_ERR, 'lex', code);
function print_exp_tree(debug_info, exp_opt, num_tabs) {
   if (num_tabs == undefined)
      num_tabs = 0;
   var tab_chars = make_tab_chars(num_tabs);

   if (ss_is_type(exp_opt, SS_ERR)) {
      badResultPrint(debug_info, exp_opt, tab_chars);
      return;
   }

   var exp_val = ss_get_val(exp_opt);
   if (ss_is_type(exp_opt, SS_STR))
      console.log(tab_chars + 'str: "' + exp_val + '"');
   /*else if (ss_is_type(exp, SS_CON)) {
      console.log('sub: ');
      cons_map(e, print_exp_tree_raw);
   }*/
   else if (ss_is_type(exp_opt, SS_Q)) { //SS_QQ, SS_CMA
      console.log(tab_chars + 'quote: \' {default}');
      print_exp_tree(debug_info, exp_val, num_tabs + 1);
   }
   else if (ss_is_type(exp_opt, SS_QQ)) {
      console.log(tab_chars + 'quote: ` {quasiquote}');
      print_exp_tree(debug_info, exp_val, num_tabs + 1);
   }
   else if (ss_is_type(exp_opt, SS_CMA)) {
      console.log(tab_chars + 'quote: , {comma}');
      print_exp_tree(debug_info, exp_val, num_tabs + 1);
   }
   else if (ss_is_type(exp_opt, SS_INT))
      console.log(tab_chars + 'int: ' + exp_val);
   else if (ss_is_type(exp_opt, SS_SYM))
      console.log(tab_chars + 'sym: ' + exp_val);
   else if (ss_is_type(exp_opt, SS_ARR)) {
      console.log(tab_chars + 'sub: ');
      ss_get_val(exp_opt).map(function (x) {
         print_exp_tree(debug_info, x, num_tabs+1);
      });
   }
   else
      console.log(num_tabs + "other type: " + JSON.stringify(exp_opt));
}

function test_parse_ranges() {
   //uncomment print_child_range_res(child_ranges_ret); in parse()
   var test_parse_str1 = '(+ (- 3 5) 15)';
   var test_parse_str2 = '(+ (- 3 5) 15'; //Missing Close Parenthesis
   var test_parse_str3 = '+ (- 3 5) 15)'; //Missing Open Parenthesis
   var test_parse_str4 = '+ (- 3 5) 15'; //atom 0-0, nonatom 1-5, atom 6-6

   var to_parse = test_parse_str4;
   var lexed_opt = lex(to_parse);
   if (ss_is_type(lexed_opt, SS_ERR)) //return lexed_opt;
      console.log("lexing test error");
   var lexed = ss_get_val(lexed_opt);

   var parsed = parse(lexed);
   print_exp_raw(parsed);
}

function test_parse() {
   var test_parse_str1 = '(+ (- 3 5) 15)';
   var test_parse_str2 = '(+ 3)';
   var test_parse_str3 = "',`(+ ',3)"; //TODO!!!
   var test_parse_str4 = "'(+ 3 5)";
   var test_parse_str5 = "(+ 3 5) (- 2 1)";
   var test_parse_str6 = "(define (f x y) (+ y 5 (* x x)))";
   var test_parse_str7 = "(blah 't '(+ 3 5))";
   var test_parse_str8 = "'yo";
   var test_parse_str9 = "((define x (+ 3 5)) (define (f x y) (- 3 10) (+ x y 4 2)))";
   var test_parse_str10 = "#|"; //lex err "Unterminated Comment"
   var test_parse_str11 = "\""; //lex err "Unterminated Quote"
   var test_parse_str12 = "|#"; //TODO!!
   var test_parse_str13 = ")";

   var to_parse = test_parse_str1;
   var lexed_opt = lex(to_parse);
   if (ss_is_type(lexed_opt, SS_ERR)) {
      print_exp_tree(debug_info, lexed_opt); //return lexed_opt;
      return;
   }
   var lexed = ss_get_val(lexed_opt);

   var parsed = parse(lexed);
   //print_exp_tree(parsed);
   //print_exp_tree_raw(parsed);
   //print_exp_tree_raw(parsed['value'][0]);
   //print_exp_tree(parsed['value'][0]);
   print_exp_tree(parsed);
}

function test_scm_parser(fpath) {
   console.log('parsing ' + fpath);
   var fs = require('fs');

   var code = fs.readFileSync(fpath, {encoding:'utf8', flags:'r'});
   //console.log(code);

   var lexed_opt = lex(code);
    if (ss_is_type(lexed_opt, SS_ERR)) {
      var debug_info = {
         'origin_src' : code,
         'lexeme_indices' : null
      }
      print_exp_tree(debug_info, lexed_opt, 0);
      return;
   }
   //_print_lex_result(lexed_opt); //TODO: only for lex testing

   var lexed = ss_get_val(lexed_opt);
   var parsed = parse(lexed);
   //print_exp_tree(parsed);
   //print_exp_tree_raw(parsed);
   //print_exp_tree_raw(parsed['value'][0]);
   //print_exp_tree(parsed['value'][0]);

   var debug_info = {
      'origin_src' : code,
      'lexeme_indices' : lexed
   }
   print_exp_tree(debug_info, parsed, 0);
}

//END PARSER STUFF

function main() {
   //test_lex_get_block_ranges();
   //test_lex();
   //test_parse();
   test_scm_parser('irtest.scm'); //'ir.scm'
}

main();

//MISC Generic Helper Utilities
function is_int(x) {
   var str = x.toString();
   return (x.length > 0) && is_numeric(str) && str.indexOf('.') == -1;
}
function is_float(x) {
   var str = x.toString();
   return is_numeric(str) && str.indexOf('.') != -1;
}
function is_number_like(str) { return str.length > 0 && !isNaN(str[0]); } //TODO
function is_numeric(str) { return !isNaN(str); } //TODO
function to_num(str) { return parseFloat(str); } //TODO
function repeat_str(s, n) {
   var ret = '';
   while (n-- > 0)
      ret += s;
   return ret;
}
function make_tab_chars(n) { return repeat_str('   ', n); }

//TODO: broken, removeme
//http://stackoverflow.com/questions/1181575/determine-whether-an-array-contains-a-value
var _contains = function(needle) {
   // Per spec, the way to identify NaN is that it is not equal to itself
   var findNaN = needle !== needle;
   var indexOf;

   if(!findNaN && typeof Array.prototype.indexOf === 'function') {
      indexOf = Array.prototype.indexOf;
   } else {
      indexOf = function(needle) {
         var i = -1, index = -1;

         for(i = 0; i < this.length; i++) {
            var item = this[i];

            if((findNaN && item !== item) || item === needle) {
               index = i;
               break;
            }
         }

         return index;
      };
   }

   return indexOf.call(this, needle) > -1;
};
function contains(arr, needle) {
   //return _contains.call(arr, needle);
   //$.inArray(arr, needle);
   for (var i in arr) {
      if (arr[i] == needle) return true;
   }
   return false;
}

exports.ss_mk_var = ss_mk_var;
exports.SS_CON = SS_CON;
