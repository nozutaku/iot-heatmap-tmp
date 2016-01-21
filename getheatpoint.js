
/* ★★★★★★★　チューニング箇所（ここから) ★★★★★★★　*/
var show_latest_x_min = 1440; //最新Ｘ分のデータ表示。「10分」or「60分」or「3時間(=180分)」or 「1日(=1440分)」 

var DEBUG_NOT_HEROKU = 0;	//herokuサーバを使わないデバッグ用→ http://localhost:1234
var LOG_OUTPUT = 0;
/* ★★★★★★★　チューニング箇所（ここまで) ★★★★★★★　*/


var http = require('http');
var fs = require('fs');
var request = require('request');
var ejs = require('ejs');
var express = require('express');       // npm install express --save

var app = express();
//app.use(express.static('public'));
//app.use('/static', express.static('public'));
//app.use('/static', express.static(__dirname + '/public'));

//<script src="./leaflet.js"></script>
//<script src="./leaflet-heat.js"></script>

//var show_map = fs.readFileSync('./show_map.ejs', 'utf8');
var show_map = fs.readFileSync('public/TEST_samplehm0.ejs', 'utf8');

var db_raw_data = new Array();  //DBからの生データ配列

var db_checking=0;  // DBから応答返ってきているか否か。1=チェック中(応答待), 0=それ以外



/* ===================================
   express使ってみる
   ***********************************/

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

//app.use(express.static('public'));
//app.use('/static', express.static('public'));
//app.use('/static', express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  doRequest( request, response );
});

//response.send('Hello World!')

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});

/* ==========================================
//expressを使うために一時コメントアウト

var server = http.createServer();
server.on('request', doRequest);



if(DEBUG_NOT_HEROKU){
	server.listen(1234);
}else{
	server.listen(process.env.PORT, process.env.IP);
}
console.log('Server running!');
 ============================================== */


/**********************************************************
* heroku から何度も呼ばれるメイン処理
* 
***********************************************************/
function doRequest(req, res) {

    console.log("doRequest");
    
    if( db_checking == 1 ){
        console.log("doRequest return immediately");
        return;
    }
    
    // databaseから取得
//    var raw_data = getHotPointFromDB( show_latest_x_min );
    getHotPointFromDB( show_latest_x_min, res );
    
    // ★★★★★★kintoneからデータ取れた後はここが呼ばれない。
    console.log("db_checking after db=" + db_checking);
    
    if( db_checking == 1 ){
        sendClientToData( MODE_WAITTING, res );
    }
    
/*
    if( db_checking != 1 ){

    var html = ejs.render(show_map, {

        map_data: raw_data
//        map_data: mapdata

    });
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(html);
        
    }
    else{
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write("please wait");
    }
*/
    //res.end();


}

/**********************************************************
* ブラウザへ表示データを送る
* 引数： option
*   MODE_WAITTING 
*   MODE_DATA
*   MODE_ERROR_DATA
***********************************************************/

var MODE_WAITTING = 1;
var MODE_DATA = 2;
var MODE_ERROR_DATA = 3;

function sendClientToData( option, res ){
    console.log("sendClientToData mode=" + option);
    
    if( option == MODE_DATA ){
        var html = ejs.render(show_map, {

            map_data: db_raw_data
    //        map_data: mapdata

        });
        console.log("html document write now");
        
        res.send(html);
        /*
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(html);
        res.end();
        */

    }
    else if ( option == MODE_ERROR_DATA ){
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write("I'm sorry. This site is currently closed.");
        res.end();
    }
    else{
        
        // ２回writeするとうまく動かないので１回にするためにコメントアウト
        
        //res.writeHead(200, {'Content-Type': 'text/plain'});
        //res.write("please wait");
        
        //res.end();
        // res.end()は呼ばずに継続。上記MODE_DATA or MODE_ERROR_DATA が来てからendさせる
    }

}


/**********************************************************
* kintone databaseから情報を取り出す
* 第１引数：　interval 何分前～現在までのデータを取得するか指定
* 第２引数：　res: 表示オブジェクト
***********************************************************/
function getHotPointFromDB( interval, res ){
//function getHotPointFromDB( interval ){
	var table = new Array();

	console.log("start check kintone");


	//設定要
	var KINTONE_URL = "https://v2urc.cybozu.com/k/v1/records.json?app=17";
	var httpRequestHeader1 = "X-Cybozu-API-Token";
	var httpRequestHeader1_body = "";
	var httpRequestHeader2 = "v2urc.cybozu.com";
	var httpRequestHeader2_body = "443";


    //最新Ｘ分のデータ取得。kintoneへ渡すqueryパラメータ作成
    //API仕様⇒  https://cybozudev.zendesk.com/hc/ja/articles/202331474-%E3%83%AC%E3%82%B3%E3%83%BC%E3%83%89%E3%81%AE%E5%8F%96%E5%BE%97-GET-#step2
    
    
    //現在時刻からinterval分前の時刻を計算
    var show_time = new Date( Date.now() - interval * 60*1000 );
    
    var query_time = '"' 
                    +show_time.getFullYear() + "-" 
                    + toDoubleDigits(show_time.getMonth()+1) + "-"
                    + toDoubleDigits(show_time.getDate()) + "T" 
                    + toDoubleDigits(show_time.getHours()) + ":" 
                    + toDoubleDigits(show_time.getMinutes()) + ":" 
                    + toDoubleDigits(show_time.getSeconds()) 
                    + "+0000" + '"';  //format = 2012-02-03T09:00:00+0900
    
    if( LOG_OUTPUT ){console.log("query_time = " + query_time); }
    
    var query_string = "time > " + query_time;
    
    if( LOG_OUTPUT ){ console.log("query_string=" + query_string ); }
    
    var query_string2 = KINTONE_URL + "&query=" + encodeURIComponent( query_string );
    if( LOG_OUTPUT ){ console.log("query_string2 = " + query_string2); }
    
    
	// DBを取得
	var options = {
		url: query_string2,
//        url: KINTONE_URL,
		headers: {'X-Cybozu-API-Token': 'hidden. please ask nozu.'},
		json: true
	};


    
    db_checking = 1;
    
	request.get(options, function(error, response, body){
		if(!error && response.statusCode == 200){
				console.log("get success!");

            
            /* DBから取得した生データ（時間クエリー付） */
            for( var i=0; i < Object.keys(body.records).length; i++ ){
                db_raw_data[i] = new Array();
                db_raw_data[i][0] = body.records[i].latitude.value;
                db_raw_data[i][1] = body.records[i].longitude.value;
                db_raw_data[i][2] = body.records[i].count.value;
                
                if( LOG_OUTPUT ){
                    console.log("[" + i + "]=" + db_raw_data[i][0] + ", " + db_raw_data[i][1] + ", " + db_raw_data[i][2]);
                }
                
            }

            if( LOG_OUTPUT ){
/*
				console.log("lat = " + body.records[0].latitude.value);
				console.log("lon = " + body.records[0].longitude.value);
				console.log("count = " + body.records[0].count.value);
				console.log("time = " + body.records[0].time.value);
*/
            }
            
            db_checking = 0;
            sendClientToData( MODE_DATA, res );     //子関数から表示データ送るのは気持ち悪い。。。他の方法があれば教えてください。
            //return table; returnなしにしよう

		}else{
			console.log('error: ' + response.statusCode);
            db_checking = 0;
            sendClientToData( MODE_ERROR_DATA, res );
            //return table;　returnなしにしよう
		}
	});

    if( LOG_OUTPUT ){ console.log("db_checking=" + db_checking); }
	//return table;
}


/**********************************************************
* 1桁数字の場合は２桁にする
***********************************************************/
function toDoubleDigits(num){
    num += "";
    if( num.length === 1){
        num = "0" + num;
    }
    return num;
}

/**********************************************************
* 今日か否か判定
***********************************************************/
function isToday( iso_date ){	// "2015-12-16T20:29:00Z"というString
	var ret;

	iso_date_formatted = new Date( iso_date );
	nowDate = new Date();
	
//	console.log("iso_date_formatted = " + iso_date_formatted.getDate() );
//	console.log("nowDate = " + nowDate.getDate() );

	if( iso_date_formatted.getDate() == nowDate.getDate() ){
		ret = 1;
	}else{
		ret = 0;
	}
	
	return( ret );

}