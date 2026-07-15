const SoundFX=(function(){let enabled=!0;try{const saved=localStorage.getItem("chessSoundEnabled");if(saved!==null)enabled=saved==="1"}catch(e){}
const BASE="Assets/sounds/";
const files={move:"move.mp3",capture:"capturing.mp3",castle:"castling.mp3",check:"check.mp3",checkmate:"game_over__checkmate_.mp3",stalemate:"game_over__stalemate_.mp3",resign:"game_over__resign_.mp3",start:"Game_start.mp3"};
const cache={};
function getAudio(key){if(!cache[key]){cache[key]=new Audio(BASE+files[key]);cache[key].preload="auto"}
return cache[key]}
function play(key){if(!enabled)return;try{const base=getAudio(key);const node=base.readyState>0?base.cloneNode():base;node.currentTime=0;const p=node.play();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
return{
playMove(){play("move")},
playCapture(){play("capture")},
playCastle(){play("castle")},
playCheck(){play("check")},
playCheckmate(){play("checkmate")},
playStalemate(){play("stalemate")},
playResign(){play("resign")},
playStart(){play("start")},
isEnabled(){return enabled},
setEnabled(v){enabled=!!v;try{localStorage.setItem("chessSoundEnabled",enabled?"1":"0")}catch(e){}}
}})();
let _pieceUidCounter=0;function nextPieceUid(){return++_pieceUidCounter}
const PIECE_LETTER={pawn:"p",knight:"n",bishop:"b",rook:"r",queen:"q",king:"k"};
/* ===================== Board & Piece Appearance Themes ===================== */
const PIECE_THEMES={
neo:{label:"Neo",slug:"neo"},
classic:{label:"Classic",slug:"classic"},
wood:{label:"Wood",slug:"wood"},
glass:{label:"Glass",slug:"glass"},
gothic:{label:"Gothic",slug:"gothic"},
metal:{label:"Metal",slug:"metal"},
bases:{label:"Bases",slug:"bases"},
cases:{label:"Cases",slug:"cases"},
light:{label:"Light",slug:"light"},
alpha:{label:"Alpha",slug:"alpha"}
};
function makeNoiseTexture(colorRgba,freq){const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' result='noise'/><feColorMatrix in='noise' type='matrix' values='0 0 0 0 ${colorRgba[0]}  0 0 0 0 ${colorRgba[1]}  0 0 0 0 ${colorRgba[2]}  0 0 0 ${colorRgba[3]} 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>`;return`url("data:image/svg+xml,${svg}")`}
const BOARD_THEMES={
green:{label:"Green (default)",light:"#eeeed2",dark:"#769656"},
brown:{label:"Brown",light:"#f0d9b5",dark:"#b58863"},
blue:{label:"Blue",light:"#dee3e6",dark:"#8ca2ad"},
gray:{label:"Gray",light:"#e5e5e5",dark:"#8b8b8b"},
purple:{label:"Purple",light:"#e8e0f0",dark:"#8877b0"},
coral:{label:"Coral",light:"#f3dcd3",dark:"#c9745a"},
wood:{label:"Wood",light:"#e4c99b",dark:"#8a5a34",texture:makeNoiseTexture([0.36,0.24,0.12,0.55],0.9)},
marble:{label:"Marble",light:"#f2f0ea",dark:"#9aa0a6",texture:makeNoiseTexture([0.1,0.1,0.12,0.35],0.7)}
};
let currentPieceTheme="neo",currentBoardTheme="green";
try{const savedPT=localStorage.getItem("chessPieceTheme");if(savedPT&&PIECE_THEMES[savedPT])currentPieceTheme=savedPT}catch(e){}
try{const savedBT=localStorage.getItem("chessBoardTheme");if(savedBT&&BOARD_THEMES[savedBT])currentBoardTheme=savedBT}catch(e){}
function applyBoardTheme(){const theme=BOARD_THEMES[currentBoardTheme]||BOARD_THEMES.green;const root=document.documentElement.style;root.setProperty("--light-square-color",theme.light);root.setProperty("--dark-square-color",theme.dark);root.setProperty("--board-texture",theme.texture||"none")}
function withPieceImgFallback(img){img.addEventListener("error",function onErr(){if(img.dataset.fallbackApplied)return;img.dataset.fallbackApplied="1";img.src=img.src.replace(/\/pieces\/[^/]+\//,"/pieces/neo/")},{once:!0});return img}
function refreshAllPieceImages(){Object.values(pieceByUid||{}).forEach((p)=>{if(p)p.img=pieceImgSrc(p.piece_name)});document.querySelectorAll("img.piece").forEach((img)=>{const name=img.dataset.pieceName;if(!name)return;img.dataset.fallbackApplied="";img.src=pieceImgSrc(name)});if(typeof renderPlayerBars==="function")renderPlayerBars()}
function pieceUrl(color,type){const slug=(PIECE_THEMES[currentPieceTheme]||PIECE_THEMES.neo).slug;return`https://images.chesscomfiles.com/chess-themes/pieces/${slug}/150/${color[0]}${PIECE_LETTER[type]}.png`}
function blackPawn(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("black","pawn"),piece_name:"BLACK_PAWN"}}
function blackBishop(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("black","bishop"),piece_name:"BLACK_BISHOP"}}
function blackKnight(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("black","knight"),piece_name:"BLACK_KNIGHT"}}
function blackKing(current_position){return{uid:nextPieceUid(),move:!1,current_position,img:pieceUrl("black","king"),piece_name:"BLACK_KING"}}
function blackQueen(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("black","queen"),piece_name:"BLACK_QUEEN"}}
function blackRook(current_position){return{uid:nextPieceUid(),move:!1,current_position,img:pieceUrl("black","rook"),piece_name:"BLACK_ROOK"}}
function whitePawn(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("white","pawn"),piece_name:"WHITE_PAWN"}}
function whiteRook(current_position){return{uid:nextPieceUid(),move:!1,current_position,img:pieceUrl("white","rook"),piece_name:"WHITE_ROOK"}}
function whiteKnight(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("white","knight"),piece_name:"WHITE_KNIGHT"}}
function whiteBishop(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("white","bishop"),piece_name:"WHITE_BISHOP"}}
function whiteQueen(current_position){return{uid:nextPieceUid(),current_position,img:pieceUrl("white","queen"),piece_name:"WHITE_QUEEN"}}
function whiteKing(current_position){return{uid:nextPieceUid(),move:!1,current_position,img:pieceUrl("white","king"),piece_name:"WHITE_KING"}}
function initGame(){const columns=["a","b","c","d","e","f","g","h"];const board=[];for(let row=8;row>=1;row--){const rowArr=[];columns.forEach((col,colIndex)=>{const id=`${col}${row}`;const isBlack=(colIndex+row)%2!==0;rowArr.push({id,color:isBlack?"black":"white",piece:null,highlight:null,captureHighlight:!1})});board.push(rowArr)}
return board}
const globalState=initGame();let keySquareMapper={};globalState.flat().forEach((square)=>{keySquareMapper[square.id]=square});String.prototype.replaceAt=function(index,replacement){return this.substring(0,index)+replacement+this.substring(index+replacement.length)};const ROOT_DIV=document.getElementById("root");function checkPieceOfOpponentOnElement(id,color){const opponentColor=color==="white"?"BLACK":"WHITE";const element=keySquareMapper[id];if(!element)return!1;if(element.piece&&element.piece.piece_name.includes(opponentColor)){const el=document.getElementById(id);el.classList.add("captureColor");element.captureHighlight=!0;return!0}
return!1}
function checkPieceOfOpponentOnElementNoDom(id,color){const opponentColor=color==="white"?"BLACK":"WHITE";const element=keySquareMapper[id];if(!element)return!1;if(element.piece&&element.piece.piece_name.includes(opponentColor))return!0;return!1}
function checkWeatherPieceExistsOrNot(squareId){const square=keySquareMapper[squareId];return square.piece?square:!1}
function checkSquareCaptureId(array){let returnArray=[];for(let index=0;index<array.length;index++){const squareId=array[index];const square=keySquareMapper[squareId];if(square.piece)break;returnArray.push(squareId)}
return returnArray}
function giveBishopHighlightIds(id){function topLeft(id){let alpha=id[0],num=Number(id[1]),result=[];while(alpha!=="a"&&num!==8){alpha=String.fromCharCode(alpha.charCodeAt(0)-1);num++;result.push(`${alpha}${num}`)}
return result}
function bottomLeft(id){let alpha=id[0],num=Number(id[1]),result=[];while(alpha!=="a"&&num!==1){alpha=String.fromCharCode(alpha.charCodeAt(0)-1);num--;result.push(`${alpha}${num}`)}
return result}
function topRight(id){let alpha=id[0],num=Number(id[1]),result=[];while(alpha!=="h"&&num!==8){alpha=String.fromCharCode(alpha.charCodeAt(0)+1);num++;result.push(`${alpha}${num}`)}
return result}
function bottomRight(id){let alpha=id[0],num=Number(id[1]),result=[];while(alpha!=="h"&&num!==1){alpha=String.fromCharCode(alpha.charCodeAt(0)+1);num--;result.push(`${alpha}${num}`)}
return result}
return{topLeft:topLeft(id),bottomLeft:bottomLeft(id),topRight:topRight(id),bottomRight:bottomRight(id)}}
function giveBishopCaptureIds(id,color){if(!id)return[];const{bottomLeft,topLeft,bottomRight,topRight}=giveBishopHighlightIds(id);const dirs=[bottomLeft,topLeft,bottomRight,topRight];let returnArr=[];for(const arr of dirs){for(const element of arr){const checkPieceResult=checkWeatherPieceExistsOrNot(element);if(checkPieceResult&&checkPieceResult.piece&&checkPieceResult.piece.piece_name.toLowerCase().includes(color))break;if(checkPieceOfOpponentOnElementNoDom(element,color)){returnArr.push(element);break}}}
return returnArr}
function giveRookHighlightIds(id){function top(id){let alpha=id[0],num=Number(id[1]),result=[];while(num!==8){num++;result.push(`${alpha}${num}`)}
return result}
function bottom(id){let alpha=id[0],num=Number(id[1]),result=[];while(num!==1){num--;result.push(`${alpha}${num}`)}
return result}
function right(id){let alpha=id[0],num=Number(id[1]),result=[];while(alpha!=="h"){alpha=String.fromCharCode(alpha.charCodeAt(0)+1);result.push(`${alpha}${num}`)}
return result}
function left(id){let alpha=id[0],num=Number(id[1]),result=[];while(alpha!=="a"){alpha=String.fromCharCode(alpha.charCodeAt(0)-1);result.push(`${alpha}${num}`)}
return result}
return{top:top(id),bottom:bottom(id),right:right(id),left:left(id)}}
function giveRookCapturesIds(id,color){if(!id)return[];const{bottom,top,right,left}=giveRookHighlightIds(id);const dirs=[bottom,top,right,left];let returnArr=[];for(const arr of dirs){for(const element of arr){const checkPieceResult=checkWeatherPieceExistsOrNot(element);if(checkPieceResult&&checkPieceResult.piece&&checkPieceResult.piece.piece_name.toLowerCase().includes(color))break;if(checkPieceOfOpponentOnElementNoDom(element,color)){returnArr.push(element);break}}}
return returnArr}
function giveQueenHighlightIds(id){const rookMoves=giveRookHighlightIds(id);const bishopMoves=giveBishopHighlightIds(id);return{left:rookMoves.left,right:rookMoves.right,top:rookMoves.top,bottom:rookMoves.bottom,topLeft:bishopMoves.topLeft,topRight:bishopMoves.topRight,bottomLeft:bishopMoves.bottomLeft,bottomRight:bishopMoves.bottomRight,}}
function giveQueenCapturesIds(id,color){if(!id)return[];return[...giveBishopCaptureIds(id,color),...giveRookCapturesIds(id,color)]}
function giveKnightHighlightIds(id){if(!id)return;function left(){let alpha=id[0],num=Number(id[1]),result=[],temp=0;while(alpha!=="a"){if(temp===2)break;alpha=String.fromCharCode(alpha.charCodeAt(0)-1);result.push(`${alpha}${num}`);temp++}
if(result.length===2){const last=result[result.length-1],a=last[0],n=Number(last[1]),out=[];if(n<8)out.push(`${a}${n + 1}`);if(n>1)out.push(`${a}${n - 1}`);return out}
return[]}
function top(){let alpha=id[0],num=Number(id[1]),result=[],temp=0;while(num!==8){if(temp===2)break;num++;result.push(`${alpha}${num}`);temp++}
if(result.length===2){const last=result[result.length-1],a=last[0],n=Number(last[1]),out=[];if(a!=="h")out.push(`${String.fromCharCode(a.charCodeAt(0) + 1)}${n}`);if(a!=="a")out.push(`${String.fromCharCode(a.charCodeAt(0) - 1)}${n}`);return out}
return[]}
function right(){let alpha=id[0],num=Number(id[1]),result=[],temp=0;while(alpha!=="h"){if(temp===2)break;alpha=String.fromCharCode(alpha.charCodeAt(0)+1);result.push(`${alpha}${num}`);temp++}
if(result.length===2){const last=result[result.length-1],a=last[0],n=Number(last[1]),out=[];if(n<8)out.push(`${a}${n + 1}`);if(n>1)out.push(`${a}${n - 1}`);return out}
return[]}
function bottom(){let alpha=id[0],num=Number(id[1]),result=[],temp=0;while(num!==1){if(temp===2)break;num--;result.push(`${alpha}${num}`);temp++}
if(result.length===2){const last=result[result.length-1],a=last[0],n=Number(last[1]),out=[];if(a!=="h")out.push(`${String.fromCharCode(a.charCodeAt(0) + 1)}${n}`);if(a!=="a")out.push(`${String.fromCharCode(a.charCodeAt(0) - 1)}${n}`);return out}
return[]}
return[...top(),...bottom(),...left(),...right()]}
function giveKnightCaptureIds(id,color){if(!id)return[];return giveKnightHighlightIds(id).filter(el=>checkPieceOfOpponentOnElementNoDom(el,color))}
function giveKingHighlightIds(id){const rookMoves=giveRookHighlightIds(id);const bishopMoves=giveBishopHighlightIds(id);const result={left:rookMoves.left,right:rookMoves.right,top:rookMoves.top,bottom:rookMoves.bottom,topLeft:bishopMoves.topLeft,topRight:bishopMoves.topRight,bottomLeft:bishopMoves.bottomLeft,bottomRight:bishopMoves.bottomRight,};for(const key in result){if(result[key].length!==0)result[key]=[result[key][0]]}
return result}
function giveKingCaptureIds(id,color){if(!id)return[];return Object.values(giveKingHighlightIds(id)).flat().filter(el=>checkPieceOfOpponentOnElementNoDom(el,color))}
const globalPiece=new Object();function globalStateRender(){globalState.forEach((row)=>{row.forEach((element)=>{if(element.highlight){const span=document.createElement("span");span.classList.add("highlight");document.getElementById(element.id).appendChild(span)}else{const el=document.getElementById(element.id);Array.from(el.querySelectorAll("span.highlight")).forEach(s=>el.removeChild(s))}})})}
function selfHighlight(piece){document.getElementById(piece.current_position).classList.add("highlightYellow")}
function pieceRender(data){data.forEach((row)=>{row.forEach((square)=>{if(square.piece){const squareEl=document.getElementById(square.id);const img=document.createElement("img");img.src=square.piece.img;img.dataset.pieceName=square.piece.piece_name;img.dataset.pieceUid=square.piece.uid;img.classList.add("piece");withPieceImgFallback(img);squareEl.appendChild(img)}})})}
function initGameRender(data){data.forEach((element)=>{const rowEl=document.createElement("div");element.forEach((square,colIndex)=>{const squareDiv=document.createElement("div");squareDiv.id=square.id;squareDiv.classList.add(square.color,"square");if(colIndex===0){const rankLabel=document.createElement("span");rankLabel.classList.add("coord","coord-rank");rankLabel.textContent=square.id[1];squareDiv.appendChild(rankLabel)}
if(square.id[1]==="1"){const fileLabel=document.createElement("span");fileLabel.classList.add("coord","coord-file");fileLabel.textContent=square.id[0];squareDiv.appendChild(fileLabel)}
if(square.id[1]==7){square.piece=blackPawn(square.id);globalPiece.black_pawns=globalPiece.black_pawns||[];globalPiece.black_pawns.push(square.piece)}
if(square.id=="h8"||square.id=="a8"){square.piece=blackRook(square.id);if(globalPiece.black_rook_1)globalPiece.black_rook_2=square.piece;else globalPiece.black_rook_1=square.piece}
if(square.id=="b8"||square.id=="g8"){square.piece=blackKnight(square.id);if(globalPiece.black_knight_1)globalPiece.black_knight_2=square.piece;else globalPiece.black_knight_1=square.piece}
if(square.id=="c8"||square.id=="f8"){square.piece=blackBishop(square.id);if(globalPiece.black_bishop_1)globalPiece.black_bishop_2=square.piece;else globalPiece.black_bishop_1=square.piece}
if(square.id=="d8"){square.piece=blackQueen(square.id);globalPiece.black_queen=square.piece}
if(square.id=="e8"){square.piece=blackKing(square.id);globalPiece.black_king=square.piece}
if(square.id[1]==2){square.piece=whitePawn(square.id);globalPiece.white_pawns=globalPiece.white_pawns||[];globalPiece.white_pawns.push(square.piece)}
if(square.id=="d1"){square.piece=whiteQueen(square.id);globalPiece.white_queen=square.piece}
if(square.id=="e1"){square.piece=whiteKing(square.id);globalPiece.white_king=square.piece}
if(square.id=="h1"||square.id=="a1"){square.piece=whiteRook(square.id);if(globalPiece.white_rook_1)globalPiece.white_rook_2=square.piece;else globalPiece.white_rook_1=square.piece}
if(square.id=="b1"||square.id=="g1"){square.piece=whiteKnight(square.id);if(globalPiece.white_knight_1)globalPiece.white_knight_2=square.piece;else globalPiece.white_knight_1=square.piece}
if(square.id=="c1"||square.id=="f1"){square.piece=whiteBishop(square.id);if(globalPiece.white_bishop_1)globalPiece.white_bishop_2=square.piece;else globalPiece.white_bishop_1=square.piece}
rowEl.appendChild(squareDiv)});rowEl.classList.add("squareRow");ROOT_DIV.appendChild(rowEl)});pieceRender(data)}
function renderHighlight(squareId){const span=document.createElement("span");span.classList.add("highlight");document.getElementById(squareId).appendChild(span)}
function clearHightlight(){globalState.flat().forEach((el)=>{if(el.captureHighlight){document.getElementById(el.id).classList.remove("captureColor");el.captureHighlight=!1}
if(el.highlight)el.highlight=null;globalStateRender()})}
class ModalCreator{constructor(body,useBlur=!0){if(!body)throw new Error("Please pass the body");this.open=!1;this.body=body;this.useBlur=useBlur}
show(){this.open=!0;document.body.appendChild(this.body);if(this.useBlur)document.getElementById("root").classList.add("blur");}
hide(){this.open=!1;document.body.removeChild(this.body);if(this.useBlur)document.getElementById("root").classList.remove("blur");}}
function pawnPromotion(color,callback,id){const squareEl=document.getElementById(id);const box=document.createElement("div");box.classList.add("promotionBox");if(color==="black")box.classList.add("promotionBoxUp");const options=[{fn:color==="white"?whiteQueen:blackQueen,src:pieceUrl(color,"queen")},{fn:color==="white"?whiteKnight:blackKnight,src:pieceUrl(color,"knight")},{fn:color==="white"?whiteRook:blackRook,src:pieceUrl(color,"rook")},{fn:color==="white"?whiteBishop:blackBishop,src:pieceUrl(color,"bishop")},];options.forEach(({fn,src})=>{const img=document.createElement("img");img.src=src;withPieceImgFallback(img);img.onclick=(event)=>{event.stopPropagation();callback(fn,id);box.remove()};box.appendChild(img)});squareEl.appendChild(box)}
function showCheckmateAnimation(losingColor){const winningColor=losingColor==="white"?"black":"white";const loserKing=globalPiece[`${losingColor}_king`];const winnerKing=globalPiece[`${winningColor}_king`];if(loserKing?.current_position){const loserBadge=document.createElement("div");loserBadge.classList.add("checkmateBadge","checkmateBadgeRed");const loserImg=document.createElement("img");loserImg.src=loserKing.img;loserImg.classList.add("checkmateRotate");loserBadge.appendChild(loserImg);document.getElementById(loserKing.current_position)?.appendChild(loserBadge)}
if(winnerKing?.current_position){const winnerBadge=document.createElement("div");winnerBadge.classList.add("checkmateBadge","checkmateBadgeGreen");const winnerImg=document.createElement("img");winnerImg.src=pieceUrl(winningColor,"queen");winnerBadge.appendChild(winnerImg);document.getElementById(winnerKing.current_position)?.appendChild(winnerBadge)}}
function resetGame(){ROOT_DIV.innerHTML="";const freshBoard=initGame();globalState.length=0;freshBoard.forEach((row)=>globalState.push(row));Object.keys(keySquareMapper).forEach((k)=>delete keySquareMapper[k]);globalState.flat().forEach((square)=>{keySquareMapper[square.id]=square});Object.keys(globalPiece).forEach((k)=>delete globalPiece[k]);inTurn="white";whoInCheck=null;selfHighlightState=null;moveState=null;enPassant=null;gameOver=!1;hightlight_state=!1;initGameRender(globalState)}
function showEndModal(message){const box=document.createElement("div");box.classList.add("endModalBox");const closeBtn=document.createElement("button");closeBtn.textContent="×";closeBtn.classList.add("modalClose");closeBtn.setAttribute("aria-label","Close");const msg=document.createElement("p");msg.textContent=message;const btnRow=document.createElement("div");btnRow.classList.add("endModalBtnRow");const rematchBtn=document.createElement("button");rematchBtn.textContent="Rematch";rematchBtn.classList.add("rematchBtn");const reviewBtn=document.createElement("button");reviewBtn.textContent="Review Game";reviewBtn.classList.add("rematchBtn","reviewBtn");btnRow.append(rematchBtn,reviewBtn);box.appendChild(closeBtn);box.appendChild(msg);box.appendChild(btnRow);const container=document.createElement("div");container.appendChild(box);container.classList.add("modal","endModal");const modal=new ModalCreator(container,!1);closeBtn.onclick=()=>modal.hide();rematchBtn.onclick=()=>{modal.hide();resetGame()};reviewBtn.onclick=()=>{modal.hide();openGameReview()};modal.show()}
let hightlight_state=!1;let inTurn="white";let whoInCheck=null;let selfHighlightState=null;let moveState=null;let enPassant=null;let gameOver=!1;function changeTurn(){inTurn=inTurn==="white"?"black":"white"}
function getPiecesByColor(color){const singles=Object.keys(globalPiece).filter((k)=>k.startsWith(color)&&k!==`${color}_pawns`).map((k)=>globalPiece[k]);const pawns=globalPiece[`${color}_pawns`]||[];return singles.concat(pawns).filter((p)=>p&&p.current_position)}
function sliderAttackSquares(dirArray){const result=[];for(const sq of dirArray){result.push(sq);if(keySquareMapper[sq].piece)break}
return result}
function attackedSquaresByColor(color){const attacked=new Set();getPiecesByColor(color).forEach((p)=>{const pos=p.current_position;const name=p.piece_name.toLowerCase();if(name.includes("knight")){(giveKnightHighlightIds(pos)||[]).forEach((s)=>attacked.add(s))}else if(name.includes("king")){Object.values(giveKingHighlightIds(pos)).flat().forEach((s)=>attacked.add(s))}else if(name.includes("bishop")){Object.values(giveBishopHighlightIds(pos)).forEach((arr)=>sliderAttackSquares(arr).forEach((s)=>attacked.add(s)))}else if(name.includes("rook")){Object.values(giveRookHighlightIds(pos)).forEach((arr)=>sliderAttackSquares(arr).forEach((s)=>attacked.add(s)))}else if(name.includes("queen")){Object.values(giveQueenHighlightIds(pos)).forEach((arr)=>sliderAttackSquares(arr).forEach((s)=>attacked.add(s)))}else if(name.includes("pawn")){const colChar=pos[0],row=Number(pos[1]);const dir=color==="white"?1:-1;const targetRow=row+dir;if(targetRow>=1&&targetRow<=8){if(colChar!=="a")attacked.add(`${String.fromCharCode(colChar.charCodeAt(0) - 1)}${targetRow}`);if(colChar!=="h")attacked.add(`${String.fromCharCode(colChar.charCodeAt(0) + 1)}${targetRow}`);}}});return attacked}
function isKingInCheck(color){const kingPos=globalPiece[`${color}_king`]?.current_position;if(!kingPos)return!1;const opponent=color==="white"?"black":"white";return attackedSquaresByColor(opponent).has(kingPos)}
function checkForCheck(){whoInCheck=null;if(inTurn==="black"&&isKingInCheck("white"))whoInCheck="white";if(inTurn==="white"&&isKingInCheck("black"))whoInCheck="black";renderCheckState()}
function renderCheckState(){document.querySelectorAll(".inCheck").forEach((el)=>el.classList.remove("inCheck"));if(whoInCheck){const pos=globalPiece[`${whoInCheck}_king`]?.current_position;if(pos)document.getElementById(pos)?.classList.add("inCheck");}}
function candidateMoves(piece){const pos=piece.current_position;if(!pos)return[];const name=piece.piece_name.toLowerCase();const color=name.includes("white")?"white":"black";if(name.includes("pawn")){const moves=[];const colChar=pos[0],row=Number(pos[1]);const dir=color==="white"?1:-1;const startRow=color==="white"?2:7;const oneStep=`${colChar}${row + dir}`;if(keySquareMapper[oneStep]&&!keySquareMapper[oneStep].piece){moves.push(oneStep);const twoStep=`${colChar}${row + 2 * dir}`;if(row===startRow&&keySquareMapper[twoStep]&&!keySquareMapper[twoStep].piece)moves.push(twoStep);}
const leftCol=String.fromCharCode(colChar.charCodeAt(0)-1);const rightCol=String.fromCharCode(colChar.charCodeAt(0)+1);[`${leftCol}${row + dir}`,`${rightCol}${row + dir}`].forEach((sq)=>{if(!keySquareMapper[sq])return;if(checkPieceOfOpponentOnElementNoDom(sq,color))moves.push(sq);else if(enPassant&&sq===enPassant.square&&enPassant.pawn.piece_name.toLowerCase().includes(color==="white"?"black":"white"))moves.push(sq);});return moves}
if(name.includes("knight")){return(giveKnightHighlightIds(pos)||[]).filter((s)=>!(keySquareMapper[s].piece&&keySquareMapper[s].piece.piece_name.toLowerCase().includes(color)))}
if(name.includes("bishop")){return Object.values(giveBishopHighlightIds(pos)).map((arr)=>checkSquareCaptureId(arr)).flat().concat(giveBishopCaptureIds(pos,color))}
if(name.includes("rook")){return Object.values(giveRookHighlightIds(pos)).map((arr)=>checkSquareCaptureId(arr)).flat().concat(giveRookCapturesIds(pos,color))}
if(name.includes("queen")){return Object.values(giveQueenHighlightIds(pos)).map((arr)=>checkSquareCaptureId(arr)).flat().concat(giveQueenCapturesIds(pos,color))}
if(name.includes("king")){return Object.values(giveKingHighlightIds(pos)).flat().filter((sq)=>!(keySquareMapper[sq].piece&&keySquareMapper[sq].piece.piece_name.toLowerCase().includes(color)))}
return[]}
function hasLegalMove(color){const pieces=getPiecesByColor(color);for(const piece of pieces){const moves=candidateMoves(piece);for(const dest of moves){const originSquare=piece.current_position;const destSquareObj=keySquareMapper[dest];const capturedPiece=destSquareObj.piece||null;let epSquare=null,epPiece=null;if(piece.piece_name.toLowerCase().includes("pawn")&&enPassant&&dest===enPassant.square&&!capturedPiece){epSquare=enPassant.pawn.current_position;epPiece=enPassant.pawn}
keySquareMapper[originSquare].piece=null;destSquareObj.piece=piece;const oldPos=piece.current_position;piece.current_position=dest;const capturedPos=capturedPiece?capturedPiece.current_position:null;if(capturedPiece)capturedPiece.current_position=null;if(epSquare){keySquareMapper[epSquare].piece=null;epPiece.current_position=null}
const stillInCheck=isKingInCheck(color);keySquareMapper[originSquare].piece=piece;piece.current_position=oldPos;destSquareObj.piece=capturedPiece;if(capturedPiece)capturedPiece.current_position=capturedPos;if(epSquare){keySquareMapper[epSquare].piece=epPiece;epPiece.current_position=epSquare}
if(!stillInCheck)return!0}}
return!1}
function moveLeavesKingInCheck(piece,dest){if(!keySquareMapper[dest])return!0;const color=piece.piece_name.toLowerCase().includes("white")?"white":"black";const originSquare=piece.current_position;const destSquareObj=keySquareMapper[dest];const capturedPiece=destSquareObj.piece||null;let epSquare=null,epPiece=null;if(piece.piece_name.toLowerCase().includes("pawn")&&enPassant&&dest===enPassant.square&&!capturedPiece){epSquare=enPassant.pawn.current_position;epPiece=enPassant.pawn}
keySquareMapper[originSquare].piece=null;destSquareObj.piece=piece;const oldPos=piece.current_position;piece.current_position=dest;const capturedPos=capturedPiece?capturedPiece.current_position:null;if(capturedPiece)capturedPiece.current_position=null;if(epSquare){keySquareMapper[epSquare].piece=null;epPiece.current_position=null}
const result=isKingInCheck(color);keySquareMapper[originSquare].piece=piece;piece.current_position=oldPos;destSquareObj.piece=capturedPiece;if(capturedPiece)capturedPiece.current_position=capturedPos;if(epSquare){keySquareMapper[epSquare].piece=epPiece;epPiece.current_position=epSquare}
return result}
function isCheckmate(color){return isKingInCheck(color)&&!hasLegalMove(color)}
function isStalemate(color){return!isKingInCheck(color)&&!hasLegalMove(color)}
function captureInTurn(square){const piece=square.piece;if(piece==selfHighlightState){clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
if(square.captureHighlight&&selfHighlightState){moveElement(selfHighlightState,piece.current_position);clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal()}}
function checkForPawnPromotion(piece,id){if(!piece?.piece_name?.toLowerCase()?.includes("pawn"))return!1;return inTurn==="white"?id?.includes("8"):id?.includes("1")}
function callbackPawnPromotion(pieceFn,id){const realPiece=pieceFn(id);const oldPawn=keySquareMapper[id].piece;keySquareMapper[id].piece=realPiece;realPiece.current_position=id;const[colorPart,typePart]=realPiece.piece_name.toLowerCase().split("_");const pawns=globalPiece[`${colorPart}_pawns`];if(pawns&&oldPawn){const idx=pawns.indexOf(oldPawn);if(idx!==-1)pawns.splice(idx,1);}
let slot=`${colorPart}_${typePart}`;if(globalPiece[slot])slot=`${colorPart}_${typePart}_promoted_${Date.now()}`;globalPiece[slot]=realPiece;if(typeof registerPiece==="function")registerPiece(realPiece);const img=document.createElement("img");img.src=realPiece.img;img.dataset.pieceName=realPiece.piece_name;img.dataset.pieceUid=realPiece.uid;img.classList.add("piece");const el=document.getElementById(id);const oldImg=el.querySelector("img.piece");if(oldImg)el.removeChild(oldImg);el.append(img)}
let pendingPromotionResolvers=null;
function finalizeMoveOutcome(piece,id,castle,fromPos,wasCapture){checkForCheck();if(!castle){const isCastleMove=piece.piece_name.includes("KING")&&fromPos&&Math.abs(id.charCodeAt(0)-fromPos.charCodeAt(0))===2;changeTurn();if(isCheckmate(inTurn)){gameOver=!0;SoundFX.playCheckmate();showCheckmateAnimation(inTurn);showEndModal(`Checkmate! ${inTurn === "white" ? "Black" : "White"} wins`)}else if(isStalemate(inTurn)){gameOver=!0;SoundFX.playStalemate();showEndModal("Stalemate! It's a draw")}else if(whoInCheck){SoundFX.playCheck()}else if(isCastleMove){SoundFX.playCastle()}else if(wasCapture){SoundFX.playCapture()}else{SoundFX.playMove()}}}
function autoPromotionFn(color,letter){const fnMap={Q:color==="white"?whiteQueen:blackQueen,R:color==="white"?whiteRook:blackRook,B:color==="white"?whiteBishop:blackBishop,N:color==="white"?whiteKnight:blackKnight};return fnMap[letter]||fnMap.Q}
function moveElement(piece,id,castle,autoPromoteLetter){const pawnIsPromoted=checkForPawnPromotion(piece,id);const fromPos=piece.current_position;const isPawn=piece.piece_name.toLowerCase().includes("pawn");let enPassantCaptureSquare=null;if(isPawn&&enPassant&&id===enPassant.square&&!piece.piece_name.includes(enPassant.pawn.piece_name.split("_")[0])){enPassantCaptureSquare=enPassant.pawn.current_position}
let wasCapture=!!enPassantCaptureSquare;
if(piece.piece_name.includes("KING")||piece.piece_name.includes("ROOK")){piece.move=!0;if(piece.piece_name.includes("KING")&&piece.piece_name.includes("BLACK")&&fromPos==="e8"){if(id==="c8"||id==="g8"){const rook=keySquareMapper[id==="c8"?"a8":"h8"];if(rook&&rook.piece)moveElement(rook.piece,id==="c8"?"d8":"f8",!0)}}
if(piece.piece_name.includes("KING")&&piece.piece_name.includes("WHITE")&&fromPos==="e1"){if(id==="c1"||id==="g1"){const rook=keySquareMapper[id==="c1"?"a1":"h1"];if(rook&&rook.piece)moveElement(rook.piece,id==="c1"?"d1":"f1",!0)}}}
globalState.flat().forEach((el)=>{if(el.id==piece.current_position)delete el.piece;if(el.id==id){if(el.piece)el.piece.current_position=null;el.piece=piece}});if(enPassantCaptureSquare){const capturedSquareObj=keySquareMapper[enPassantCaptureSquare];const capturedPawn=capturedSquareObj.piece;delete capturedSquareObj.piece;if(capturedPawn)capturedPawn.current_position=null;const capEl=document.getElementById(enPassantCaptureSquare);const capImg=capEl?capEl.querySelector("img.piece"):null;if(capImg){capImg.classList.add("captureFade");setTimeout(()=>{capImg.remove()},220)}}
clearHightlight();const previousEl=document.getElementById(piece.current_position);piece.current_position=null;previousEl?.classList?.remove("highlightYellow");const currentEl=document.getElementById(id);const existingImg=currentEl.querySelector("img.piece");if(existingImg)wasCapture=!0;const movingImg=previousEl?previousEl.querySelector("img.piece"):null;if(movingImg){const oldRect=movingImg.getBoundingClientRect();if(existingImg){existingImg.classList.add("captureFade");const capImgToRemove=existingImg;setTimeout(()=>{capImgToRemove.remove()},220)}
currentEl.appendChild(movingImg);const newRect=movingImg.getBoundingClientRect();const dx=oldRect.left-newRect.left;const dy=oldRect.top-newRect.top;movingImg.style.transition="none";movingImg.style.transform=`translate(${dx}px, ${dy}px)`;movingImg.style.zIndex="20";requestAnimationFrame(()=>{requestAnimationFrame(()=>{movingImg.style.transition="transform 0.22s cubic-bezier(.2,.7,.3,1)";movingImg.style.transform="translate(0px, 0px)"})});movingImg.addEventListener("transitionend",function handler(){movingImg.style.transition="";movingImg.style.zIndex="";movingImg.removeEventListener("transitionend",handler)})}else if(existingImg){existingImg.classList.add("captureFade");setTimeout(()=>{existingImg.remove()},220)}
piece.current_position=id;if(isPawn&&fromPos&&Math.abs(Number(id[1])-Number(fromPos[1]))===2){const midRow=(Number(id[1])+Number(fromPos[1]))/2;enPassant={square:`${fromPos[0]}${midRow}`,pawn:piece}}else{enPassant=null}
if(pawnIsPromoted){
  if(autoPromoteLetter){
    const color=piece.piece_name.includes("WHITE")?"white":"black";
    callbackPawnPromotion(autoPromotionFn(color,autoPromoteLetter),id);
    finalizeMoveOutcome(piece,id,castle,fromPos,wasCapture);
  }else{
    pendingPromotionResolvers=[()=>finalizeMoveOutcome(piece,id,castle,fromPos,wasCapture)];
    pawnPromotion(inTurn,function(fn,sqId){
      callbackPawnPromotion(fn,sqId);
      const resolvers=pendingPromotionResolvers;pendingPromotionResolvers=null;
      if(resolvers)resolvers.forEach((r)=>r());
    },id);
  }
}else{
  finalizeMoveOutcome(piece,id,castle,fromPos,wasCapture);
}}
function clearPreviousSelfHighlight(piece){if(piece){document.getElementById(piece.current_position).classList.remove("highlightYellow");selfHighlightState=null}}
function clearHighlightLocal(){clearHightlight();hightlight_state=!1}
function makePieceClick(color,getHighlightFn,isDirectional){return function(square){const piece=square.piece;if(piece==selfHighlightState){clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
if(square.captureHighlight&&selfHighlightState){moveElement(selfHighlightState,piece.current_position);clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();selfHighlight(piece);hightlight_state=!0;selfHighlightState=piece;moveState=piece;const current_pos=piece.current_position;const rawIds=getHighlightFn(current_pos,piece);if(isDirectional){const dirs=Object.values(rawIds);let result=dirs.map(arr=>checkSquareCaptureId(arr)).flat();result=result.filter(h=>!moveLeavesKingInCheck(piece,h));result.forEach(h=>{keySquareMapper[h].highlight=!0});dirs.forEach(arr=>{for(const element of arr){const pr=checkWeatherPieceExistsOrNot(element);if(pr&&pr.piece&&pr.piece.piece_name.toLowerCase().includes(color))break;if(checkPieceOfOpponentOnElementNoDom(element,color)){if(!moveLeavesKingInCheck(piece,element))checkPieceOfOpponentOnElement(element,color);break}}})}else{const legalIds=rawIds.filter(h=>keySquareMapper[h]&&!(keySquareMapper[h].piece&&keySquareMapper[h].piece.piece_name.toLowerCase().includes(color))&&!moveLeavesKingInCheck(piece,h));legalIds.forEach(h=>{keySquareMapper[h].highlight=!0});legalIds.forEach(el=>checkPieceOfOpponentOnElement(el,color))}
globalStateRender()}}
function whitePawnClick(square){const piece=square.piece;if(piece==selfHighlightState){clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
if(square.captureHighlight&&selfHighlightState){moveElement(selfHighlightState,piece.current_position);clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();selfHighlight(piece);hightlight_state=!0;selfHighlightState=piece;moveState=piece;const current_pos=piece.current_position;let ids=current_pos[1]=="2"?[`${current_pos[0]}${Number(current_pos[1]) + 1}`,`${current_pos[0]}${Number(current_pos[1]) + 2}`]:[`${current_pos[0]}${Number(current_pos[1]) + 1}`];ids=checkSquareCaptureId(ids);ids=ids.filter(h=>!moveLeavesKingInCheck(piece,h));ids.forEach(h=>{keySquareMapper[h].highlight=!0});const col1=`${String.fromCharCode(current_pos[0].charCodeAt(0) - 1)}${Number(current_pos[1]) + 1}`;const col2=`${String.fromCharCode(current_pos[0].charCodeAt(0) + 1)}${Number(current_pos[1]) + 1}`;[col1,col2].forEach(el=>{if(moveLeavesKingInCheck(piece,el))return;if(checkPieceOfOpponentOnElement(el,"white"))return;if(enPassant&&el===enPassant.square&&enPassant.pawn.piece_name.includes("BLACK")){const sqObj=keySquareMapper[el];if(sqObj){document.getElementById(el)?.classList.add("captureColor");sqObj.captureHighlight=!0}}});globalStateRender()}
function blackPawnClick(square){const piece=square.piece;if(piece==selfHighlightState){clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
if(square.captureHighlight&&selfHighlightState){moveElement(selfHighlightState,piece.current_position);clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();selfHighlight(piece);hightlight_state=!0;selfHighlightState=piece;moveState=piece;const current_pos=piece.current_position;let ids=current_pos[1]=="7"?[`${current_pos[0]}${Number(current_pos[1]) - 1}`,`${current_pos[0]}${Number(current_pos[1]) - 2}`]:[`${current_pos[0]}${Number(current_pos[1]) - 1}`];ids=checkSquareCaptureId(ids);ids=ids.filter(h=>!moveLeavesKingInCheck(piece,h));ids.forEach(h=>{keySquareMapper[h].highlight=!0});const col1=`${String.fromCharCode(current_pos[0].charCodeAt(0) - 1)}${Number(current_pos[1]) - 1}`;const col2=`${String.fromCharCode(current_pos[0].charCodeAt(0) + 1)}${Number(current_pos[1]) - 1}`;[col1,col2].forEach(el=>{if(moveLeavesKingInCheck(piece,el))return;if(checkPieceOfOpponentOnElement(el,"black"))return;if(enPassant&&el===enPassant.square&&enPassant.pawn.piece_name.includes("WHITE")){const sqObj=keySquareMapper[el];if(sqObj){document.getElementById(el)?.classList.add("captureColor");sqObj.captureHighlight=!0}}});globalStateRender()}
function makeKingClick(color,rookKey1,rookKey2,emptySquares1,emptySquares2,castleTarget1,castleTarget2){return function(square){const piece=square.piece;if(piece==selfHighlightState){clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
if(square.captureHighlight&&selfHighlightState){moveElement(selfHighlightState,piece.current_position);clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();return}
clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal();selfHighlight(piece);hightlight_state=!0;selfHighlightState=piece;moveState=piece;const current_pos=piece.current_position;const rawIds=giveKingHighlightIds(current_pos);const dirs=Object.values(rawIds);let result=[];if(!piece.move&&!isKingInCheck(color)){const opponent=color==="white"?"black":"white";const attacked=attackedSquaresByColor(opponent);const rook1=globalPiece[rookKey1],rook2=globalPiece[rookKey2];if(!rook1.move&&emptySquares1.every(id=>!keySquareMapper[id].piece)&&!attacked.has(current_pos)&&emptySquares1.slice(-2).every(id=>!attacked.has(id)))result.push(castleTarget1);if(!rook2.move&&emptySquares2.every(id=>!keySquareMapper[id].piece)&&!attacked.has(current_pos)&&emptySquares2.every(id=>!attacked.has(id)))result.push(castleTarget2);}
result.push(...dirs.map(arr=>checkSquareCaptureId(arr)).flat());result=result.filter(h=>!moveLeavesKingInCheck(piece,h));result.forEach(h=>{if(keySquareMapper[h])keySquareMapper[h].highlight=!0});dirs.forEach(arr=>{for(const element of arr){const pr=checkWeatherPieceExistsOrNot(element);if(pr&&pr.piece&&pr.piece.piece_name.toLowerCase().includes(color))break;if(checkPieceOfOpponentOnElementNoDom(element,color)){if(!moveLeavesKingInCheck(piece,element))checkPieceOfOpponentOnElement(element,color);break}}});globalStateRender()}}
const whiteBishopClick=makePieceClick("white",giveBishopHighlightIds,!0);const blackBishopClick=makePieceClick("black",giveBishopHighlightIds,!0);const whiteRookClick=makePieceClick("white",giveRookHighlightIds,!0);const blackRookClick=makePieceClick("black",giveRookHighlightIds,!0);const whiteQueenClick=makePieceClick("white",giveQueenHighlightIds,!0);const blackQueenClick=makePieceClick("black",giveQueenHighlightIds,!0);const whiteKnightClick=makePieceClick("white",giveKnightHighlightIds,!1);const blackKnightClick=makePieceClick("black",giveKnightHighlightIds,!1);const whiteKingClick=makeKingClick("white","white_rook_1","white_rook_2",["b1","c1","d1"],["f1","g1"],"c1","g1");const blackKingClick=makeKingClick("black","black_rook_1","black_rook_2",["b8","c8","d8"],["f8","g8"],"c8","g8");function GlobalEvent(){ROOT_DIV.addEventListener("click",function(event){if(gameOver)return;if(typeof colorChosen!=="undefined"&&!colorChosen)return;if(typeof viewingIndex!=="undefined"&&typeof moveHistory!=="undefined"&&viewingIndex!==moveHistory.length-1)return;if(typeof playerColor!=="undefined"&&playerColor&&inTurn!==playerColor)return;if(typeof engineThinking!=="undefined"&&engineThinking)return;if(typeof pendingPromotionResolvers!=="undefined"&&pendingPromotionResolvers)return;if(event.target.localName==="img"&&event.target.classList.contains("piece")){const clickId=event.target.parentNode.id;const square=keySquareMapper[clickId];if(!square||!square.piece)return;if((square.piece.piece_name.includes("WHITE")&&inTurn==="black")||(square.piece.piece_name.includes("BLACK")&&inTurn==="white")){captureInTurn(square);return}
const name=square.piece.piece_name;if(name==="WHITE_PAWN"&&inTurn==="white")whitePawnClick(square);else if(name==="BLACK_PAWN"&&inTurn==="black")blackPawnClick(square);else if(name==="WHITE_BISHOP"&&inTurn==="white")whiteBishopClick(square);else if(name==="BLACK_BISHOP"&&inTurn==="black")blackBishopClick(square);else if(name==="WHITE_ROOK"&&inTurn==="white")whiteRookClick(square);else if(name==="BLACK_ROOK"&&inTurn==="black")blackRookClick(square);else if(name==="WHITE_KNIGHT"&&inTurn==="white")whiteKnightClick(square);else if(name==="BLACK_KNIGHT"&&inTurn==="black")blackKnightClick(square);else if(name==="WHITE_QUEEN"&&inTurn==="white")whiteQueenClick(square);else if(name==="BLACK_QUEEN"&&inTurn==="black")blackQueenClick(square);else if(name==="WHITE_KING"&&inTurn==="white")whiteKingClick(square);else if(name==="BLACK_KING"&&inTurn==="black")blackKingClick(square);}else{const target=event.target;const isHighlightSpan=target.classList&&target.classList.contains("highlight");const squareDiv=target.classList&&target.classList.contains("square")?target:target.closest(".square");const hasHighlightChild=squareDiv?squareDiv.querySelector(":scope > span.highlight"):null;const isEmptyCaptureTarget=squareDiv&&squareDiv.classList.contains("captureColor")&&!squareDiv.querySelector("img.piece");if(isHighlightSpan||hasHighlightChild||isEmptyCaptureTarget){const id=isHighlightSpan?target.parentNode.id:squareDiv.id;clearPreviousSelfHighlight(selfHighlightState);moveElement(moveState,id);moveState=null}else{clearHighlightLocal();clearPreviousSelfHighlight(selfHighlightState)}}})}
/* ===================== Bottom Nav / Move History ===================== */
let moveHistory=[];let viewingIndex=-1;let boardFlipped=!1;let startSnapshot=[];let startFullState=null;let playerColor=null;let colorChosen=!1;let pieceByUid={};
function registerPiece(p){if(p)pieceByUid[p.uid]=p}
function rebuildPieceRegistry(){pieceByUid={};globalState.flat().forEach((sq)=>registerPiece(sq.piece));Object.values(globalPiece).forEach((v)=>{if(Array.isArray(v))v.forEach(registerPiece);else registerPiece(v)})}
function captureGameState(){const board=globalState.flat().filter((sq)=>sq.piece).map((sq)=>({id:sq.id,uid:sq.piece.uid,move:sq.piece.move}));return{board,inTurn,whoInCheck,gameOver,enPassant:enPassant?{square:enPassant.square,uid:enPassant.pawn.uid}:null}}
function restoreGameState(state){if(!state)return;globalState.flat().forEach((sq)=>{sq.piece=null});const placedUids=new Set();state.board.forEach(({id,uid,move})=>{const piece=pieceByUid[uid];if(!piece||!keySquareMapper[id])return;piece.current_position=id;if(typeof move!=="undefined")piece.move=move;keySquareMapper[id].piece=piece;placedUids.add(String(uid))});Object.values(pieceByUid).forEach((p)=>{if(!placedUids.has(String(p.uid)))p.current_position=null});inTurn=state.inTurn;whoInCheck=state.whoInCheck;gameOver=state.gameOver;enPassant=state.enPassant?{square:state.enPassant.square,pawn:pieceByUid[state.enPassant.uid]}:null}
function updateUndoButtonState(){const btn=document.getElementById("undoBtn");if(!btn)return;btn.disabled=moveHistory.length===0;btn.classList.toggle("navBtnDisabled",moveHistory.length===0)}
function undoMove(){stopPlayback();if(moveHistory.length===0)return;moveHistory.pop();const targetIndex=moveHistory.length-1;const targetState=targetIndex===-1?startFullState:moveHistory[targetIndex].fullState;const targetSnapshot=targetIndex===-1?startSnapshot:moveHistory[targetIndex].snapshot;selfHighlightState=null;moveState=null;clearHightlight();document.querySelectorAll(".highlightYellow").forEach((el)=>el.classList.remove("highlightYellow"));document.querySelectorAll(".captureColor").forEach((el)=>el.classList.remove("captureColor"));restoreGameState(targetState);restoreSnapshot(targetSnapshot);viewingIndex=targetIndex;clearCheckVisuals();applyMoveVisuals(targetIndex===-1?null:moveHistory[targetIndex]);renderMoveList();renderPlayerBars();updateGrabCursors()}

const ENGINE_LOGO_URL="https://images.chesscomfiles.com/uploads/v1/bot_personality/4c07340e-8a5d-11ea-9abb-79b3443058a1.6bfb2f43.384x384o.9fad36f33baf.png";const PLAYER_AVATAR_URL="data:image/svg+xml;utf8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#689f38"/><circle cx="16" cy="12" r="6" fill="#fff"/><path d="M4 30c0-7 5-11 12-11s12 4 12 11" fill="#fff"/></svg>');let playerName="You";let engineName="Stockfish";
function createPlayerBar(id){const bar=document.createElement("div");bar.classList.add("playerBar");bar.id=id;bar.innerHTML=`<img class="playerAvatar" id="${id}Avatar" alt=""><div class="playerNameWrap"><span class="playerName" id="${id}Name"></span></div><div class="playerCaptured" id="${id}Captured"></div><span class="materialAdv" id="${id}Adv"></span>`;return bar}
function wrapBoardWithNav(){const wrapper=document.createElement("div");wrapper.id="gameWrap";document.body.insertBefore(wrapper,ROOT_DIV);const boardColumn=document.createElement("div");boardColumn.id="boardColumn";wrapper.appendChild(boardColumn);const topBar=createPlayerBar("topBar");const bottomBar=createPlayerBar("bottomBar");const boardRow=document.createElement("div");boardRow.id="boardRow";const evalBarWrap=document.createElement("div");evalBarWrap.id="evalBarWrap";evalBarWrap.innerHTML=`<span class="evalBarScore" id="evalBarScore">0.0</span><div class="evalBarFill" id="evalBarFill"></div>`;boardRow.appendChild(evalBarWrap);boardRow.appendChild(ROOT_DIV);boardColumn.appendChild(topBar);boardColumn.appendChild(boardRow);boardColumn.appendChild(bottomBar);const nav=document.createElement("div");nav.id="bottomNav";wrapper.appendChild(nav);window._bottomNavEl=nav;document.getElementById("topBarAvatar").src=ENGINE_LOGO_URL;document.getElementById("bottomBarAvatar").src=PLAYER_AVATAR_URL;renderPlayerNames()}
function getBottomColor(){return boardFlipped?"black":"white"}
function renderPlayerNames(){const bottomColor=getBottomColor();const topColor=bottomColor==="white"?"black":"white";const bottomIsPlayer=bottomColor===(playerColor||"white");document.getElementById("bottomBarName").textContent=`${bottomIsPlayer?playerName:engineName}`;document.getElementById("topBarName").textContent=`${bottomIsPlayer?engineName:playerName}`;const bottomAvatarEl=document.getElementById("bottomBarAvatar"),topAvatarEl=document.getElementById("topBarAvatar");if(bottomAvatarEl)bottomAvatarEl.src=bottomIsPlayer?PLAYER_AVATAR_URL:ENGINE_LOGO_URL;if(topAvatarEl)topAvatarEl.src=bottomIsPlayer?ENGINE_LOGO_URL:PLAYER_AVATAR_URL}
const PIECE_VALUE={QUEEN:9,ROOK:5,BISHOP:3,KNIGHT:3,PAWN:1};const PIECE_ORDER=["QUEEN","ROOK","BISHOP","KNIGHT","PAWN"];
function computeCapturedNames(){const capturedWhite=[],capturedBlack=[];Object.values(pieceByUid).forEach((p)=>{if(!p||p.current_position||p.piece_name.includes("KING"))return;if(p.piece_name.startsWith("WHITE"))capturedWhite.push(p.piece_name);else capturedBlack.push(p.piece_name)});return{capturedWhite,capturedBlack}}
function sumValue(names){return names.reduce((sum,n)=>sum+(PIECE_VALUE[n.split("_")[1]]||0),0)}
function renderCapturedRow(containerId,names,color){const container=document.getElementById(containerId);if(!container)return;container.innerHTML="";const counts={};names.forEach((n)=>{const type=n.split("_")[1];counts[type]=(counts[type]||0)+1});PIECE_ORDER.forEach((type)=>{const c=counts[type];if(!c)return;const group=document.createElement("span");group.classList.add("capturedGroup");for(let i=0;i<c;i++){const img=document.createElement("img");img.src=pieceUrl(color,type.toLowerCase());withPieceImgFallback(img);img.classList.add("capturedPieceIcon");if(i>0)img.style.marginLeft="-9px";group.appendChild(img)}
container.appendChild(group)})}
function renderPlayerBars(){if(!document.getElementById("topBar"))return;const bottomColor=getBottomColor();const topColor=bottomColor==="white"?"black":"white";const{capturedWhite,capturedBlack}=computeCapturedNames();const bottomCaptured=bottomColor==="white"?capturedBlack:capturedWhite;const topCaptured=topColor==="white"?capturedBlack:capturedWhite;renderCapturedRow("bottomBarCaptured",bottomCaptured,topColor);renderCapturedRow("topBarCaptured",topCaptured,bottomColor);const bottomVal=sumValue(bottomCaptured),topVal=sumValue(topCaptured);const diff=bottomVal-topVal;document.getElementById("bottomBarAdv").textContent=diff>0?`+${diff}`:"";document.getElementById("topBarAdv").textContent=diff<0?`+${-diff}`:"";renderPlayerNames()}

function pieceLetter(name){if(name.includes("KNIGHT"))return"N";if(name.includes("KING"))return"K";if(name.includes("QUEEN"))return"Q";if(name.includes("ROOK"))return"R";if(name.includes("BISHOP"))return"B";return""}

function takeSnapshot(){return globalState.flat().filter((sq)=>sq.piece).map((sq)=>({id:sq.id,piece_name:sq.piece.piece_name,uid:sq.piece.uid}))}

function pieceImgSrc(piece_name){const parts=piece_name.toLowerCase().split("_");const color=parts[0];const type=parts.slice(1).join("");return pieceUrl(color,type)}

function readDisplayedSnapshot(){const result=[];globalState.flat().forEach((sq)=>{const el=document.getElementById(sq.id);if(!el)return;const img=el.querySelector("img.piece:not(.captureFade)");if(img&&img.dataset.pieceUid)result.push({id:sq.id,piece_name:img.dataset.pieceName,uid:img.dataset.pieceUid})});return result}

function finalizeInFlightPieceAnimations(){document.querySelectorAll("img.piece").forEach((img)=>{if(img.classList.contains("captureFade")){img.remove();return}
img.style.transition="none";img.style.transform="none";img.style.opacity="1";img.style.zIndex=""})}

function restoreSnapshot(snapshot){finalizeInFlightPieceAnimations();const currentSnapshot=readDisplayedSnapshot();const currentByUid={};currentSnapshot.forEach((e)=>{currentByUid[e.uid]=e});const targetByUid={};snapshot.forEach((e)=>{targetByUid[String(e.uid)]=e});const allUids=new Set([...Object.keys(currentByUid),...Object.keys(targetByUid)]);const movePairs=[],toRemove=[],toAdd=[];allUids.forEach((uid)=>{const cur=currentByUid[uid];const tgt=targetByUid[uid];if(cur&&tgt){if(cur.id!==tgt.id)movePairs.push({from:cur.id,to:tgt.id})}else if(cur&&!tgt){toRemove.push({id:cur.id})}else if(!cur&&tgt){toAdd.push({name:tgt.piece_name,uid:tgt.uid,id:tgt.id})}});
toRemove.forEach(({id})=>{const el=document.getElementById(id);const img=el&&el.querySelector("img.piece:not(.captureFade)");if(!img)return;img.classList.add("captureFade");setTimeout(()=>{if(img.isConnected&&img.classList.contains("captureFade"))img.remove()},220)});
movePairs.forEach(({from,to})=>{const fromEl=document.getElementById(from);const img=fromEl&&fromEl.querySelector("img.piece:not(.captureFade)");if(!img)return;const oldRect=img.getBoundingClientRect();const toEl=document.getElementById(to);if(!toEl)return;toEl.querySelectorAll("img.piece").forEach((el)=>{if(el!==img&&!el.classList.contains("captureFade"))el.remove()});toEl.appendChild(img);const newRect=img.getBoundingClientRect();const dx=oldRect.left-newRect.left,dy=oldRect.top-newRect.top;img.style.transition="none";img.style.transform=`translate(${dx}px, ${dy}px)`;img.style.zIndex="20";requestAnimationFrame(()=>{requestAnimationFrame(()=>{img.style.transition="transform 0.22s cubic-bezier(.2,.7,.3,1)";img.style.transform="translate(0px, 0px)"})});img.addEventListener("transitionend",function handler(){img.style.transition="";img.style.zIndex="";img.removeEventListener("transitionend",handler)},{once:!0})});
toAdd.forEach(({name,uid,id})=>{const el=document.getElementById(id);if(!el)return;el.querySelectorAll("img.piece").forEach((oldImg)=>{if(!oldImg.classList.contains("captureFade"))oldImg.remove()});const img=document.createElement("img");img.src=pieceImgSrc(name);img.dataset.pieceName=name;img.dataset.pieceUid=uid;img.classList.add("piece");img.style.opacity="0";el.appendChild(img);requestAnimationFrame(()=>{requestAnimationFrame(()=>{img.style.transition="opacity 0.22s ease";img.style.opacity="1"})});img.addEventListener("transitionend",function handler(){img.style.transition="";img.style.opacity="";img.removeEventListener("transitionend",handler)},{once:!0})});
correctBoardAgainstSnapshot(snapshot)}

function correctBoardAgainstSnapshot(snapshot){const nonEmptyIds=new Set();snapshot.forEach((e)=>nonEmptyIds.add(e.id));
snapshot.forEach(({id,uid,piece_name})=>{const el=document.getElementById(id);if(!el)return;const imgs=Array.from(el.querySelectorAll("img.piece:not(.captureFade)"));const match=imgs.find((im)=>String(im.dataset.pieceUid)===String(uid));if(match){imgs.forEach((im)=>{if(im!==match)im.remove()});return}
imgs.forEach((im)=>im.remove());const img=document.createElement("img");img.src=pieceImgSrc(piece_name);img.dataset.pieceName=piece_name;img.dataset.pieceUid=uid;img.classList.add("piece");el.appendChild(img)});
globalState.flat().forEach((sq)=>{if(nonEmptyIds.has(sq.id))return;const el=document.getElementById(sq.id);if(!el)return;el.querySelectorAll("img.piece:not(.captureFade)").forEach((im)=>im.remove())})}

const _origMoveElement=moveElement;
moveElement=function(piece,id,castle,autoPromoteLetter){const fromPos=piece.current_position;const pieceName=piece.piece_name;const isKing=pieceName.includes("KING");const isPawn=pieceName.includes("PAWN");const color=pieceName.includes("WHITE")?"white":"black";const targetHadPiece=!!(keySquareMapper[id]&&keySquareMapper[id].piece);const isEnPassant=isPawn&&enPassant&&id===enPassant.square&&!targetHadPiece;const capture=targetHadPiece||isEnPassant;const isCastleMove=!castle&&isKing&&fromPos&&Math.abs(id.charCodeAt(0)-fromPos.charCodeAt(0))===2;
const tail=()=>{
if(castle)return;
let san;
if(isCastleMove){san=id[0]==="g"?"O-O":"O-O-O"}else{const letter=pieceLetter(pieceName);let promo="";const postPiece=keySquareMapper[id]&&keySquareMapper[id].piece;if(isPawn&&postPiece&&!postPiece.piece_name.includes("PAWN"))promo="="+pieceLetter(postPiece.piece_name);if(letter===""){san=(capture?fromPos[0]+"x":"")+id+promo}else{san=letter+(capture?"x":"")+id}}
const opponent=color==="white"?"black":"white";if(whoInCheck===opponent)san+=gameOver?"#":"+";
const promoLetter=isPawn?(()=>{const p=keySquareMapper[id]&&keySquareMapper[id].piece;return p&&!p.piece_name.includes("PAWN")?pieceLetter(p.piece_name).toLowerCase():null})():null;
const moveNumber=Math.floor(moveHistory.length/2)+1;moveHistory.push({san,color,moveNumber,from:fromPos,to:id,promotion:promoLetter,snapshot:takeSnapshot(),fullState:captureGameState(),checkColor:whoInCheck,checkmate:gameOver&&!!whoInCheck});viewingIndex=moveHistory.length-1;renderMoveList();renderPlayerBars()};
_origMoveElement(piece,id,castle,autoPromoteLetter);
if(pendingPromotionResolvers){pendingPromotionResolvers.push(tail)}else{tail()}};

const _origResetGame=resetGame;
resetGame=function(){stopPlayback();_origResetGame();rebuildPieceRegistry();moveHistory=[];viewingIndex=-1;boardFlipped=!1;startSnapshot=takeSnapshot();startFullState=captureGameState();renderMoveList();renderPlayerBars();playerColor=null;colorChosen=!1;showColorPicker()};

function clearCheckVisuals(){document.querySelectorAll(".checkmateBadge").forEach((el)=>el.remove());document.querySelectorAll(".inCheck").forEach((el)=>el.classList.remove("inCheck"))}

function applyMoveVisuals(entry){clearCheckVisuals();if(!entry)return;if(entry.checkColor){const kingEntry=entry.snapshot.find((p)=>p.piece_name===`${entry.checkColor.toUpperCase()}_KING`);if(kingEntry)document.getElementById(kingEntry.id)?.classList.add("inCheck")}
if(entry.checkmate&&entry===moveHistory[moveHistory.length-1]&&gameOver)showCheckmateAnimation(entry.checkColor)}

function playSoundForEntry(entry){if(!entry)return;const san=entry.san||"";const isMate=san.indexOf("#")!==-1||!!entry.checkmate;const isGameOver=isMate||(entry.fullState&&entry.fullState.gameOver);
if(isMate){SoundFX.playCheckmate();return}
if(isGameOver){SoundFX.playStalemate();return}
if(san.indexOf("+")!==-1||entry.checkColor){SoundFX.playCheck();return}
if(san.indexOf("O-O")===0){SoundFX.playCastle();return}
if(san.indexOf("x")!==-1){SoundFX.playCapture();return}
SoundFX.playMove()}

function goToMove(index,silent){const changed=index!==viewingIndex;viewingIndex=index;const entry=index===-1?null:moveHistory[index];const snap=index===-1?startSnapshot:entry.snapshot;const fullState=index===-1?startFullState:entry.fullState;restoreGameState(fullState);restoreSnapshot(snap);renderCheckState();applyMoveVisuals(entry);renderMoveList();renderPlayerBars();syncReviewPanelSelection();if(!silent&&changed)playSoundForEntry(entry)}

let isPlaying=!1;let playbackTimer=null;const PLAYBACK_STEP_MS=650;

function updatePlayButton(){const icon=document.getElementById("playIcon");const label=document.getElementById("playLabel");if(!icon)return;icon.innerHTML=isPlaying?"&#10074;&#10074;":"&#9654;";if(label)label.textContent=isPlaying?"Pause":"Play"}

function stopPlayback(){if(playbackTimer){clearTimeout(playbackTimer);playbackTimer=null}
if(isPlaying){isPlaying=!1;updatePlayButton()}}

function schedulePlaybackStep(){playbackTimer=setTimeout(()=>{playbackTimer=null;if(!isPlaying)return;if(viewingIndex<moveHistory.length-1){goToMove(viewingIndex+1);if(viewingIndex<moveHistory.length-1)schedulePlaybackStep();else stopPlayback()}else{stopPlayback()}},PLAYBACK_STEP_MS)}

function startPlayback(){if(moveHistory.length===0)return;if(viewingIndex>=moveHistory.length-1)goToMove(-1);isPlaying=!0;updatePlayButton();schedulePlaybackStep()}

function togglePlayback(){if(isPlaying)stopPlayback();else startPlayback()}

function renderMoveList(){const scrollEl=document.getElementById("moveListScroll");if(!scrollEl)return;scrollEl.innerHTML="";for(let i=0;i<moveHistory.length;i+=2){const pairEl=document.createElement("span");pairEl.classList.add("movePair");const num=document.createElement("span");num.classList.add("moveNum");num.textContent=`${moveHistory[i].moveNumber}.`;pairEl.appendChild(num);const whiteSpan=document.createElement("span");whiteSpan.classList.add("moveSan");whiteSpan.textContent=moveHistory[i].san;if(i===viewingIndex)whiteSpan.classList.add("activeMove");whiteSpan.onclick=()=>{stopPlayback();goToMove(i)};pairEl.appendChild(whiteSpan);if(moveHistory[i+1]){const blackSpan=document.createElement("span");blackSpan.classList.add("moveSan");blackSpan.textContent=moveHistory[i+1].san;if(i+1===viewingIndex)blackSpan.classList.add("activeMove");blackSpan.onclick=()=>{stopPlayback();goToMove(i+1)};pairEl.appendChild(blackSpan)}
scrollEl.appendChild(pairEl)}
requestAnimationFrame(()=>{const active=scrollEl.querySelector(".activeMove");if(active){const target=active.offsetLeft-scrollEl.clientWidth/2+active.offsetWidth/2;scrollEl.scrollLeft=Math.max(0,target)}});updateUndoButtonState()}

function updateCoordLabels(){document.querySelectorAll("#root .coord").forEach((el)=>el.remove());const rows=Array.from(ROOT_DIV.children);rows.forEach((rowEl,rowIdx)=>{const squares=Array.from(rowEl.children);squares.forEach((sq,colIdx)=>{const id=sq.id;if(colIdx===0){const rankLabel=document.createElement("span");rankLabel.classList.add("coord","coord-rank");rankLabel.textContent=id[1];sq.appendChild(rankLabel)}
if(rowIdx===rows.length-1){const fileLabel=document.createElement("span");fileLabel.classList.add("coord","coord-file");fileLabel.textContent=id[0];sq.appendChild(fileLabel)}})});}

function flipBoard(){boardFlipped=!boardFlipped;const rows=Array.from(ROOT_DIV.children).reverse();rows.forEach((rowEl)=>{ROOT_DIV.appendChild(rowEl);const squares=Array.from(rowEl.children).reverse();squares.forEach((sq)=>rowEl.appendChild(sq))});updateCoordLabels()}

function resignGame(){if(gameOver)return;const resigningColor=playerColor||inTurn;const box=document.createElement("div");box.classList.add("endModalBox");const closeBtn=document.createElement("button");closeBtn.textContent="×";closeBtn.classList.add("modalClose");closeBtn.setAttribute("aria-label","Close");const msg=document.createElement("p");msg.textContent="Resign this game?";const yesBtn=document.createElement("button");yesBtn.textContent="Resign";yesBtn.classList.add("rematchBtn");box.append(closeBtn,msg,yesBtn);const container=document.createElement("div");container.appendChild(box);container.classList.add("modal","endModal");const modal=new ModalCreator(container,!1);closeBtn.onclick=()=>modal.hide();yesBtn.onclick=()=>{modal.hide();gameOver=!0;SoundFX.playResign();const winner=resigningColor==="white"?"Black":"White";showEndModal(`${resigningColor==="white"?"White":"Black"} resigned. ${winner} wins`)};modal.show()}

function openOptionsMenu(){const box=document.createElement("div");box.classList.add("optionsBox");const closeBtn=document.createElement("button");closeBtn.textContent="×";closeBtn.classList.add("modalClose");closeBtn.setAttribute("aria-label","Close");const title=document.createElement("h3");title.classList.add("optionsTitle");title.textContent="Options";const list=document.createElement("div");list.classList.add("optionsList");const switchBtn=document.createElement("button");switchBtn.classList.add("optionItem");switchBtn.textContent="Switch Sides";const flipBtn=document.createElement("button");flipBtn.classList.add("optionItem");flipBtn.textContent="Flip Board";const newBtn=document.createElement("button");newBtn.classList.add("optionItem");newBtn.textContent="New Game";if(moveHistory.length>0){switchBtn.disabled=!0;switchBtn.classList.add("optionItemDisabled");switchBtn.title="Only available before the first move"}
const soundBtn=document.createElement("button");soundBtn.classList.add("optionItem");soundBtn.textContent=SoundFX.isEnabled()?"Sound: On":"Sound: Off";soundBtn.onclick=()=>{SoundFX.setEnabled(!SoundFX.isEnabled());soundBtn.textContent=SoundFX.isEnabled()?"Sound: On":"Sound: Off";if(SoundFX.isEnabled())SoundFX.playMove()};
const appearanceBtn=document.createElement("button");appearanceBtn.classList.add("optionItem");appearanceBtn.textContent="Board & Pieces";appearanceBtn.onclick=()=>{modal.hide();openAppearanceMenu()};
list.append(switchBtn,flipBtn,soundBtn,appearanceBtn,newBtn);box.append(closeBtn,title,list);const container=document.createElement("div");container.appendChild(box);container.classList.add("modal","optionsModal");const modal=new ModalCreator(container,!1);closeBtn.onclick=()=>modal.hide();switchBtn.onclick=()=>{if(switchBtn.disabled)return;stopPlayback();modal.hide();showColorPicker()};flipBtn.onclick=()=>{stopPlayback();flipBoard();modal.hide()};newBtn.onclick=()=>{stopPlayback();modal.hide();resetGame()};modal.show()}

function openAppearanceMenu(){const box=document.createElement("div");box.classList.add("optionsBox","appearanceBox");const closeBtn=document.createElement("button");closeBtn.textContent="×";closeBtn.classList.add("modalClose");closeBtn.setAttribute("aria-label","Close");const title=document.createElement("h3");title.classList.add("optionsTitle");title.textContent="Board & Pieces";
const pieceLabel=document.createElement("div");pieceLabel.classList.add("themeSectionLabel");pieceLabel.textContent="Piece Set";
const pieceGrid=document.createElement("div");pieceGrid.classList.add("themeGrid");
Object.keys(PIECE_THEMES).forEach((key)=>{const theme=PIECE_THEMES[key];const swatch=document.createElement("button");swatch.classList.add("themeSwatch","pieceSwatch");if(key===currentPieceTheme)swatch.classList.add("themeSwatchActive");const img=document.createElement("img");img.src=`https://images.chesscomfiles.com/chess-themes/pieces/${theme.slug}/150/wn.png`;img.alt=theme.label;img.onerror=()=>{img.src=`https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png`};const label=document.createElement("span");label.textContent=theme.label;swatch.append(img,label);swatch.onclick=()=>{currentPieceTheme=key;try{localStorage.setItem("chessPieceTheme",key)}catch(e){}pieceGrid.querySelectorAll(".themeSwatch").forEach((s)=>s.classList.remove("themeSwatchActive"));swatch.classList.add("themeSwatchActive");refreshAllPieceImages()};pieceGrid.appendChild(swatch)});
const boardLabel=document.createElement("div");boardLabel.classList.add("themeSectionLabel");boardLabel.textContent="Board Theme";
const boardGrid=document.createElement("div");boardGrid.classList.add("themeGrid");
Object.keys(BOARD_THEMES).forEach((key)=>{const theme=BOARD_THEMES[key];const swatch=document.createElement("button");swatch.classList.add("themeSwatch","boardSwatch");if(key===currentBoardTheme)swatch.classList.add("themeSwatchActive");const preview=document.createElement("span");preview.classList.add("boardSwatchPreview");preview.style.background=`linear-gradient(135deg, ${theme.light} 50%, ${theme.dark} 50%)`;if(theme.texture){preview.style.backgroundImage=`${theme.texture}, linear-gradient(135deg, ${theme.light} 50%, ${theme.dark} 50%)`;preview.style.backgroundBlendMode="multiply"}
const label=document.createElement("span");label.textContent=theme.label;swatch.append(preview,label);swatch.onclick=()=>{currentBoardTheme=key;try{localStorage.setItem("chessBoardTheme",key)}catch(e){}boardGrid.querySelectorAll(".themeSwatch").forEach((s)=>s.classList.remove("themeSwatchActive"));swatch.classList.add("themeSwatchActive");applyBoardTheme()};boardGrid.appendChild(swatch)});
box.append(closeBtn,title,pieceLabel,pieceGrid,boardLabel,boardGrid);const container=document.createElement("div");container.appendChild(box);container.classList.add("modal","optionsModal");const modal=new ModalCreator(container,!1);closeBtn.onclick=()=>modal.hide();modal.show()}

function buildBottomNav(){if(typeof reviewActive!=="undefined")reviewActive=!1;if(typeof reviewRowEls!=="undefined")reviewRowEls=null;const _evalWrap=document.getElementById("evalBarWrap");if(_evalWrap)_evalWrap.classList.remove("evalBarVisible");startSnapshot=takeSnapshot();startFullState=captureGameState();const nav=window._bottomNavEl;nav.innerHTML=`<div class="moveListBar"><button class="navArrow" id="navPrev" aria-label="Previous move">&#8249;</button><div class="moveListScroll" id="moveListScroll"></div><button class="navArrow" id="navNext" aria-label="Next move">&#8250;</button></div><div class="navButtons"><button class="navBtn" id="playBtn"><span class="navIcon" id="playIcon">&#9654;</span><span id="playLabel">Play</span></button><button class="navBtn" id="undoBtn"><span class="navIcon">&#8630;</span><span>Undo</span></button><button class="navBtn" id="optionsBtn"><span class="navIcon">&#9776;</span><span>Options</span></button><button class="navBtn" id="resignBtn"><span class="navIcon">&#9873;</span><span>Resign</span></button><button class="navBtn" id="reviewGameBtn"><span class="navIcon">&#128269;</span><span>Review</span></button></div><div class="reviewPanel" id="reviewPanel"><div class="reviewPanelHeader"><span>Game Review</span><button class="reviewCloseBtn" id="reviewCloseBtn" aria-label="Close review">&times;</button></div><div class="reviewMoveList" id="reviewMoveList"></div></div>`;document.getElementById("navPrev").onclick=()=>{stopPlayback();if(viewingIndex>-1)goToMove(viewingIndex-1)};document.getElementById("navNext").onclick=()=>{stopPlayback();if(viewingIndex<moveHistory.length-1)goToMove(viewingIndex+1)};document.getElementById("playBtn").onclick=togglePlayback;document.getElementById("resignBtn").onclick=()=>{stopPlayback();resignGame()};document.getElementById("optionsBtn").onclick=()=>{stopPlayback();openOptionsMenu()};document.getElementById("undoBtn").onclick=()=>undoMove();document.getElementById("reviewGameBtn").onclick=()=>openGameReview();document.getElementById("reviewCloseBtn").onclick=()=>closeGameReview();renderMoveList();updateUndoButtonState()}
function showColorPicker(){colorChosen=!1;const overlay=document.createElement("div");overlay.classList.add("colorPickerOverlay");const box=document.createElement("div");box.classList.add("colorPickerBox");const logo=document.createElement("img");logo.src="Assets/images/ui/favicon.svg";logo.alt="";logo.classList.add("colorPickerLogo");const title=document.createElement("h3");title.classList.add("colorPickerTitle");title.textContent="Choose Your Side";const strengthWrap=document.createElement("div");strengthWrap.classList.add("strengthPicker");const strengthLabel=document.createElement("div");strengthLabel.classList.add("strengthLabel");strengthLabel.innerHTML=`<span>Engine Strength</span><span class="strengthValue" id="strengthValue">${STRENGTH_LABELS[ENGINE_DEPTH]}</span>`;const slider=document.createElement("input");slider.type="range";slider.min="0";slider.max=String(ENGINE_LEVELS.length-1);slider.step="1";slider.value=String(ENGINE_LEVELS.indexOf(ENGINE_DEPTH));slider.classList.add("strengthSlider");slider.id="strengthSlider";const strengthTicks=document.createElement("div");strengthTicks.classList.add("strengthTicks");strengthTicks.innerHTML=`<span>Easier</span><span>Stronger</span>`;slider.oninput=()=>{ENGINE_DEPTH=ENGINE_LEVELS[Number(slider.value)];document.getElementById("strengthValue").textContent=STRENGTH_LABELS[ENGINE_DEPTH]};strengthWrap.append(strengthLabel,slider,strengthTicks);const row=document.createElement("div");row.classList.add("colorChoiceRow");const whiteBtn=document.createElement("button");whiteBtn.classList.add("colorChoiceBtn","whiteChoice");whiteBtn.innerHTML=`<span class="colorSwatch"></span><span>White</span>`;const blackBtn=document.createElement("button");blackBtn.classList.add("colorChoiceBtn","blackChoice");blackBtn.innerHTML=`<span class="colorSwatch"></span><span>Black</span>`;row.append(whiteBtn,blackBtn);box.append(logo,title,strengthWrap,row);overlay.appendChild(box);document.body.appendChild(overlay);function choose(color){playerColor=color;colorChosen=!0;overlay.remove();if(color==="black"&&!boardFlipped)flipBoard();else if(color==="white"&&boardFlipped)flipBoard();SoundFX.playStart();renderPlayerBars()}
whiteBtn.onclick=()=>choose("white");blackBtn.onclick=()=>choose("black")}

/* ===================== Drag and Drop ===================== */
function updateGrabCursors(){document.querySelectorAll("img.piece").forEach((img)=>img.classList.remove("grab"));globalState.flat().forEach((sq)=>{if(!sq.piece)return;const isOwnTurn=(sq.piece.piece_name.includes("WHITE")&&inTurn==="white")||(sq.piece.piece_name.includes("BLACK")&&inTurn==="black");if(!isOwnTurn)return;const el=document.getElementById(sq.id);const img=el&&el.querySelector("img.piece");if(img)img.classList.add("grab")})}

function dispatchPieceSelect(square){const name=square.piece.piece_name;if(name==="WHITE_PAWN"&&inTurn==="white")whitePawnClick(square);else if(name==="BLACK_PAWN"&&inTurn==="black")blackPawnClick(square);else if(name==="WHITE_BISHOP"&&inTurn==="white")whiteBishopClick(square);else if(name==="BLACK_BISHOP"&&inTurn==="black")blackBishopClick(square);else if(name==="WHITE_ROOK"&&inTurn==="white")whiteRookClick(square);else if(name==="BLACK_ROOK"&&inTurn==="black")blackRookClick(square);else if(name==="WHITE_KNIGHT"&&inTurn==="white")whiteKnightClick(square);else if(name==="BLACK_KNIGHT"&&inTurn==="black")blackKnightClick(square);else if(name==="WHITE_QUEEN"&&inTurn==="white")whiteQueenClick(square);else if(name==="BLACK_QUEEN"&&inTurn==="black")blackQueenClick(square);else if(name==="WHITE_KING"&&inTurn==="white")whiteKingClick(square);else if(name==="BLACK_KING"&&inTurn==="black")blackKingClick(square);}

let dragState=null;let justDragged=false;

function canInteract(){if(gameOver)return!1;if(typeof colorChosen!=="undefined"&&!colorChosen)return!1;if(typeof viewingIndex!=="undefined"&&typeof moveHistory!=="undefined"&&viewingIndex!==moveHistory.length-1)return!1;if(typeof pendingPromotionResolvers!=="undefined"&&pendingPromotionResolvers)return!1;return!0}

function cleanupDrag(){if(dragState){if(dragState.clone)dragState.clone.remove();if(dragState.pieceImg)dragState.pieceImg.style.visibility="";document.body.classList.remove("grabbing")}
dragState=null}

ROOT_DIV.addEventListener("pointerdown",function(e){if(!canInteract())return;const target=e.target;if(!(target.localName==="img"&&target.classList.contains("piece")))return;const squareEl=target.parentNode;const clickId=squareEl.id;const square=keySquareMapper[clickId];if(!square||!square.piece)return;const isOwnTurn=(square.piece.piece_name.includes("WHITE")&&inTurn==="white")||(square.piece.piece_name.includes("BLACK")&&inTurn==="black");if(!isOwnTurn)return;dragState={pieceImg:target,startX:e.clientX,startY:e.clientY,dragging:!1,square}});

document.addEventListener("pointermove",function(e){if(!dragState)return;const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;if(!dragState.dragging){if(Math.abs(dx)>4||Math.abs(dy)>4){dragState.dragging=!0;dispatchPieceSelect(dragState.square);const rect=dragState.pieceImg.getBoundingClientRect();dragState.width=rect.width;dragState.height=rect.height;dragState.pieceImg.style.visibility="hidden";const clone=document.createElement("img");clone.src=dragState.pieceImg.src;clone.classList.add("piece");clone.style.position="fixed";clone.style.width=rect.width+"px";clone.style.height=rect.height+"px";clone.style.left=(e.clientX-rect.width/2)+"px";clone.style.top=(e.clientY-rect.height/2)+"px";clone.style.pointerEvents="none";clone.style.zIndex="1000";document.body.appendChild(clone);dragState.clone=clone;document.body.classList.add("grabbing")}else return}
if(dragState.clone){dragState.clone.style.left=(e.clientX-dragState.width/2)+"px";dragState.clone.style.top=(e.clientY-dragState.height/2)+"px"}});

document.addEventListener("pointerup",function(e){if(!dragState)return;if(dragState.dragging){justDragged=!0;if(dragState.clone)dragState.clone.style.display="none";const dropEl=document.elementFromPoint(e.clientX,e.clientY);const squareDiv=dropEl?dropEl.closest(".square"):null;let moved=!1;if(squareDiv){const id=squareDiv.id;const sqObj=keySquareMapper[id];if(sqObj&&(sqObj.highlight||sqObj.captureHighlight)&&selfHighlightState){clearPreviousSelfHighlight(selfHighlightState);moveElement(moveState,id);moveState=null;moved=!0}}
if(!moved){clearPreviousSelfHighlight(selfHighlightState);clearHighlightLocal()}
cleanupDrag()}else{dragState=null}});

ROOT_DIV.addEventListener("click",function(e){if(justDragged){justDragged=!1;e.stopImmediatePropagation();e.preventDefault()}},!0);

const _origMoveElementForCursor=moveElement;moveElement=function(piece,id,castle){_origMoveElementForCursor(piece,id,castle);updateGrabCursors()};

const _origResetGameForCursor=resetGame;resetGame=function(){_origResetGameForCursor();updateGrabCursors()};

const _origGoToMoveForCursor=goToMove;goToMove=function(index){_origGoToMoveForCursor(index);updateGrabCursors()};

/* ===================== Local Stockfish engine (Web Worker, no 3rd-party API) ===================== */
const STOCKFISH_WORKER_URL="https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";

class LocalStockfish{
  constructor(){this.worker=null;this.readyPromise=this._init();this._queue=Promise.resolve()}
  async _init(){
    const res=await fetch(STOCKFISH_WORKER_URL);
    if(!res.ok)throw new Error("Failed to fetch Stockfish engine script");
    const scriptText=await res.text();
    const blobUrl=URL.createObjectURL(new Blob([scriptText],{type:"application/javascript"}));
    this.worker=new Worker(blobUrl);
    await this._sendAndWait("uci","uciok");
    await this._sendAndWait("isready","readyok");
  }
  _sendAndWait(cmd,waitFor){
    return new Promise((resolve)=>{
      const onMsg=(e)=>{const line=typeof e.data==="string"?e.data:"";if(line.trim()===waitFor||line.indexOf(waitFor)===0){this.worker.removeEventListener("message",onMsg);resolve()}};
      this.worker.addEventListener("message",onMsg);
      this.worker.postMessage(cmd);
    });
  }
  // Runs one FEN analysis at a time (queued), returns {bestMoveUci, evalCp, mate}
  analyze(fen,depth){
    const task=async()=>{
      await this.readyPromise;
      const sideToMove=fen.split(" ")[1]==="b"?"black":"white";
      return new Promise((resolve)=>{
        let lastCp=null,lastMate=null;
        const onMsg=(e)=>{
          const line=typeof e.data==="string"?e.data:"";
          if(line.indexOf("score cp")!==-1){const m=/score cp (-?\d+)/.exec(line);if(m)lastCp=parseInt(m[1],10);lastMate=null}
          else if(line.indexOf("score mate")!==-1){const m=/score mate (-?\d+)/.exec(line);if(m)lastMate=parseInt(m[1],10);lastCp=null}
          if(line.indexOf("bestmove")===0){
            this.worker.removeEventListener("message",onMsg);
            const bm=/bestmove\s+(\S+)/.exec(line);
            const bestMoveUci=bm&&bm[1]!=="(none)"?bm[1]:null;
            // UCI scores are relative to the side to move; convert to a white-positive convention
            let evalCp=lastCp,mate=lastMate;
            if(sideToMove==="black"){if(evalCp!==null)evalCp=-evalCp;if(mate!==null)mate=-mate}
            resolve({bestMoveUci,evalCp,mate});
          }
        };
        this.worker.addEventListener("message",onMsg);
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth}`);
      });
    };
    const result=this._queue.then(task,task);
    this._queue=result.catch(()=>{});
    return result;
  }
  async _setMultiPV(n){
    this.worker.postMessage(`setoption name MultiPV value ${n}`);
    await this._sendAndWait("isready","readyok");
  }
  // Scores every legal move in the position (via MultiPV), used only by the weak/beginner bot to
  // deliberately pick a bad-but-not-random move instead of Stockfish's actual best move.
  // Returned scores are from the MOVER's perspective (positive = good for whoever is to move),
  // unlike analyze() which converts to a white-positive convention.
  analyzeAllMoves(fen,depth){
    const task=async()=>{
      await this.readyPromise;
      let legalCount=1;
      try{legalCount=Math.max(1,new Chess(fen).moves().length)}catch(err){legalCount=1}
      await this._setMultiPV(legalCount);
      return new Promise((resolve)=>{
        const scoresByRank={};
        const onMsg=(e)=>{
          const line=typeof e.data==="string"?e.data:"";
          if(line.indexOf("multipv")!==-1&&line.indexOf(" pv ")!==-1){
            const pvRankMatch=/multipv (\d+)/.exec(line);
            const moveMatch=/ pv (\S+)/.exec(line);
            if(pvRankMatch&&moveMatch){
              let moverCp=null,moverMate=null;
              const cpMatch=/score cp (-?\d+)/.exec(line);
              const mateMatch=/score mate (-?\d+)/.exec(line);
              if(cpMatch)moverCp=parseInt(cpMatch[1],10);
              if(mateMatch)moverMate=parseInt(mateMatch[1],10);
              scoresByRank[pvRankMatch[1]]={uci:moveMatch[1],moverCp,moverMate};
            }
          }
          if(line.indexOf("bestmove")===0){
            this.worker.removeEventListener("message",onMsg);
            const results=Object.keys(scoresByRank).sort((a,b)=>Number(a)-Number(b)).map((k)=>scoresByRank[k]);
            this._setMultiPV(1).catch(()=>{}).finally(()=>resolve(results));
          }
        };
        this.worker.addEventListener("message",onMsg);
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth}`);
      });
    };
    const result=this._queue.then(task,task);
    this._queue=result.catch(()=>{});
    return result;
  }
}

const localEngine=new LocalStockfish();
let ENGINE_DEPTH=12; // one of ENGINE_LEVELS below; higher (real depth) = stronger but slower
const WEAK_ENGINE_LEVEL=100; // sentinel: "~100 Elo" beginner mode, not a real search depth
const WEAK_ENGINE_ANALYSIS_DEPTH=8; // shallow depth used only to score every legal move for the beginner bot
const ENGINE_LEVELS=[WEAK_ENGINE_LEVEL,5,6,7,8,9,10,11,12,13,14,15];
const STRENGTH_LABELS={100:"~100 Elo (Beginner)",5:"~1200 Elo",6:"~1350 Elo",7:"~1500 Elo",8:"~1650 Elo",9:"~1800 Elo",10:"~1950 Elo",11:"~2100 Elo",12:"~2250 Elo",13:"~2450 Elo",14:"~2650 Elo",15:"~2850 Elo"};
let engineThinking=!1;
let suppressEngineAutoMove=!1;

// Beginner bot: scores every legal move shallowly, then picks one weighted toward the WORST
// options (bigger blunders are far more likely, but it's not guaranteed to always play the single
// worst move, so it doesn't feel mechanically identical every game). Falls back to null if scoring fails.
async function pickWeakMove(fen){
  let moves;
  try{moves=await localEngine.analyzeAllMoves(fen,WEAK_ENGINE_ANALYSIS_DEPTH)}catch(err){console.error("Weak engine scoring failed:",err);return null}
  if(!moves||moves.length===0)return null;
  const scored=moves.map((m)=>{
    let val;
    if(m.moverMate!=null){
      // mate FOR the mover (good) gets a large positive value; mate AGAINST the mover (bad) a large
      // negative value, with a sooner loss ranked worse than a later one.
      val=m.moverMate>0?(100000-m.moverMate):(-100000-m.moverMate);
    }else{
      val=m.moverCp!=null?m.moverCp:0;
    }
    return{uci:m.uci,val};
  });
  scored.sort((a,b)=>a.val-b.val); // worst move for the mover first
  const weights=scored.map((_,i)=>Math.pow(0.6,i));
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<scored.length;i++){r-=weights[i];if(r<=0)return scored[i].uci}
  return scored[scored.length-1].uci;
}

function buildFENUpTo(index){const game=new Chess();for(let i=0;i<=index;i++){const mv=moveHistory[i];if(!mv)break;const moveObj={from:mv.from,to:mv.to};if(mv.promotion)moveObj.promotion=mv.promotion;const result=game.move(moveObj);if(!result){console.error("chess.js failed to replay move at index",i,mv);break}}
return game.fen()}
function buildFEN(){return buildFENUpTo(viewingIndex)}

function showEngineThinking(active){const bottomColor=getBottomColor();const bottomIsPlayer=bottomColor===(playerColor||"white");const el=document.getElementById(bottomIsPlayer?"topBarName":"bottomBarName");if(!el)return;const engineColor=(playerColor||"white")==="white"?"black":"white";const label=`${engineName} (${engineColor === "white" ? "White" : "Black"})`;el.textContent=active?`${label} — thinking…`:label}

function applyEngineMove(uci){const from=uci.slice(0,2),to=uci.slice(2,4);const promoLetter=uci.length>4?uci[4].toUpperCase():null;const square=keySquareMapper[from];if(!square||!square.piece)return;const piece=square.piece;moveElement(piece,to,!1,promoLetter);
updateGrabCursors()}

async function requestEngineMove(){if(gameOver||engineThinking)return;if(!colorChosen||!playerColor)return;if(typeof viewingIndex!=="undefined"&&viewingIndex!==moveHistory.length-1)return;const engineColor=playerColor==="white"?"black":"white";if(inTurn!==engineColor)return;engineThinking=!0;showEngineThinking(!0);try{const fen=buildFEN();let bestMoveUci;if(ENGINE_DEPTH===WEAK_ENGINE_LEVEL){bestMoveUci=await pickWeakMove(fen);if(!bestMoveUci){const fallback=await localEngine.analyze(fen,6);bestMoveUci=fallback.bestMoveUci}}else{const res=await localEngine.analyze(fen,ENGINE_DEPTH);bestMoveUci=res.bestMoveUci}if(!bestMoveUci)throw new Error("No move returned by engine");if(gameOver||inTurn!==engineColor)return;applyEngineMove(bestMoveUci)}catch(err){console.error("Stockfish move failed:",err)}finally{engineThinking=!1;showEngineThinking(!1)}}

function maybeTriggerEngineMove(){if(suppressEngineAutoMove)return;if(gameOver)return;if(!colorChosen||!playerColor)return;if(typeof viewingIndex!=="undefined"&&typeof moveHistory!=="undefined"&&viewingIndex!==moveHistory.length-1)return;const engineColor=playerColor==="white"?"black":"white";if(inTurn===engineColor)setTimeout(requestEngineMove,300)}

const _origCanInteractForEngine=canInteract;
canInteract=function(){if(!_origCanInteractForEngine())return!1;if(engineThinking)return!1;if(playerColor&&inTurn!==playerColor)return!1;return!0};

const _origRenderPlayerBarsForEngine=renderPlayerBars;
renderPlayerBars=function(){_origRenderPlayerBarsForEngine();maybeTriggerEngineMove()};

const _origUndoMoveForEngine=undoMove;
undoMove=function(){suppressEngineAutoMove=!0;_origUndoMoveForEngine();if(playerColor&&inTurn!==playerColor&&moveHistory.length>0&&!gameOver){_origUndoMoveForEngine()}
suppressEngineAutoMove=!1;maybeTriggerEngineMove()};

/* ===================== Game Review (local Stockfish engine) ===================== */
const REVIEW_DEPTH=12;

/* FEN generation now handled by buildFENUpTo() via chess.js replay, defined above with buildFEN() */

async function evaluatePosition(fen){
  try{
    const{bestMoveUci,evalCp,mate}=await localEngine.analyze(fen,REVIEW_DEPTH);
    return{eval:evalCp!==null?evalCp/100:null,mate:mate!==null?mate:0,move:bestMoveUci||""};
  }catch(err){console.error("Local Stockfish evaluation failed:",err);return null}
}

function formatEval(data){if(!data)return"N/A";if(typeof data.mate==="number"&&data.mate!==0)return`M${data.mate}`;if(typeof data.eval==="number")return(data.eval>0?"+":"")+data.eval.toFixed(2);return"—"}

function formatBestMove(data){if(!data)return"";return data.san||data.text||data.move||(data.from&&data.to?`${data.from}${data.to}`:"")}

let reviewActive=!1;let reviewRowEls=null;

function syncReviewPanelSelection(){if(!reviewActive||!reviewRowEls)return;const idx=viewingIndex+1;renderReviewSelection(reviewRowEls,idx)}

function openGameReview(){stopPlayback();const panel=document.getElementById("reviewPanel");const listEl=document.getElementById("reviewMoveList");if(!panel||!listEl)return;reviewActive=!0;const evalWrap=document.getElementById("evalBarWrap");if(evalWrap)evalWrap.classList.add("evalBarVisible");panel.classList.add("reviewPanelOpen");listEl.innerHTML="";
const positions=[{label:"Start",index:-1,state:startFullState}];moveHistory.forEach((m,i)=>positions.push({label:m.san,index:i,state:m.fullState,moveNumber:m.moveNumber,color:m.color}));
const rowEls=[];positions.forEach((pos,i)=>{const item=document.createElement("div");item.classList.add("reviewMoveItem");const labelSpan=document.createElement("span");labelSpan.textContent=pos.index===-1?"Start position":`${pos.color === "white" ? `${pos.moveNumber}.` : `${pos.moveNumber}...`} ${pos.label}`;const evalSpan=document.createElement("span");evalSpan.classList.add("reviewMoveEval");evalSpan.textContent="…";item.append(labelSpan,evalSpan);item.onclick=()=>{goToMove(pos.index)};listEl.appendChild(item);rowEls.push({el:item,evalSpan,pos})});
reviewRowEls=rowEls;
goToMove(-1);
(async()=>{for(let i=0;i<rowEls.length;i++){if(!reviewActive)return;const{pos,evalSpan}=rowEls[i];const data=await evaluatePosition(buildFENUpTo(pos.index));if(!reviewActive)return;pos.evalData=data;evalSpan.textContent=formatEval(data)}})()}

function closeGameReview(){reviewActive=!1;reviewRowEls=null;const panel=document.getElementById("reviewPanel");if(panel)panel.classList.remove("reviewPanelOpen");const evalWrap=document.getElementById("evalBarWrap");if(evalWrap)evalWrap.classList.remove("evalBarVisible")}

function renderReviewSelection(rowEls,activeIdx){rowEls.forEach((r,i)=>r.el.classList.toggle("reviewMoveActive",i===activeIdx));const active=rowEls[activeIdx];if(!active)return;const container=active.el.parentElement;if(!container)return;const rTop=active.el.offsetTop,rBottom=rTop+active.el.offsetHeight;if(rTop<container.scrollTop)container.scrollTop=rTop;else if(rBottom>container.scrollTop+container.clientHeight)container.scrollTop=rBottom-container.clientHeight}

/* ===================== Live Evaluation Bar ===================== */
let evalRequestToken=0;let evalDebounceTimer=null;

function evalToWhitePercent(data){if(!data)return 50;if(typeof data.mate==="number"&&data.mate!==0)return data.mate>0?97:3;if(typeof data.eval==="number"){const e=Math.max(-10,Math.min(10,data.eval));const pct=50+50*(2/(1+Math.exp(-0.55*e))-1);return Math.max(3,Math.min(97,pct))}
return 50}

function renderEvalBar(data){const fill=document.getElementById("evalBarFill");const label=document.getElementById("evalBarScore");if(!fill)return;let pct=evalToWhitePercent(data);if(typeof boardFlipped!=="undefined"&&boardFlipped)pct=100-pct;fill.style.height=pct+"%";if(label){label.textContent=formatEval(data);label.classList.toggle("evalBarScoreDark",pct<50)}}

async function updateEvalBar(){const token=++evalRequestToken;const fen=buildFEN();const data=await evaluatePosition(fen);if(token!==evalRequestToken)return;renderEvalBar(data)}

function scheduleEvalUpdate(){if(!reviewActive)return;if(evalDebounceTimer)clearTimeout(evalDebounceTimer);evalDebounceTimer=setTimeout(updateEvalBar,150)}

const _origRenderPlayerBarsForEval=renderPlayerBars;
renderPlayerBars=function(){_origRenderPlayerBarsForEval();scheduleEvalUpdate()};

const _origFlipBoardForEval=flipBoard;
flipBoard=function(){_origFlipBoardForEval();scheduleEvalUpdate()};

applyBoardTheme();wrapBoardWithNav();initGameRender(globalState);rebuildPieceRegistry();GlobalEvent();buildBottomNav();updateCoordLabels();showColorPicker();updateGrabCursors();renderPlayerBars();
