function mapReduce(threads,incremental){
	var _this={},len,t=0,data;
	_this.idle = [];
	_this.map=function(fun){
		_this.workers=[];
		var i = 0;
		while(i<threads){
			makeWorker(fun,i);
			i++;
		}
		return _this;
	};
	function makeWorker(fun,i){
			_this.workers[i]=new Worker(URL.createObjectURL(new Blob(['var func='+fun.toString()+';\
				self.onmessage=function(event){\
					self.postMessage(func(event.data));\
				}'],{type: "text/javascript"})));
			_this.workers[i].onmessage=function(e){
				_this.reducer.postMessage(["data",e.data]);
				if(len && len>0){
					len--;
					this.postMessage(data.pop());
				}else{
					terminated(i);
				}
			};
	} 
	_this.reduce=function(fun){
		_this.reducer = new Worker(URL.createObjectURL(new Blob(['var func = '+fun.toString()+',reduced,reduceEmpty=true;\
		self.onmessage=function(event){\
			switch(event.data[0]){\
				case "data":\
					if(reduceEmpty){\
						reduced = event.data[1];\
						reduceEmpty = false;\
					}else{\
						reduced = func(reduced,event.data[1]);\
					}\
					break;\
				case "get":\
					self.postMessage(reduced);\
					break;\
				case "close":\
					self.postMessage(reduced);\
					self.close();\
			}\
		};'],{type: "text/javascript"})));
		_this.reducer.onmessage=function(e){
		_this.result = e.data;
		if(_this.cb){
			_this.cb(e.data);
		}
		};
		return _this;
	};
	function terminated(i){
		t++;
		if(incremental){
			_this.idle.push(i);
			return;
		}else{
			_this.workers[i].terminate();
		}
		if(t<threads){
			return;
		}else{
			_this.reducer.postMessage(["get"]);
		}
	}
	_this.data=function(dataList){
		if(!len || len===0){
			len = dataList.length;
			data = dataList.map(function(v){return v;});
			t=0;
			_this.workers.forEach(function(w){
				if(len>0){
				len--;
				w.postMessage(data.pop());
				}
			});
		}else{
			len = len + dataList.length;
			console.log(len);
			data= data.concat(dataList);
			while(_this.idle.length>0 && len>0){
				var next = _this.idle.pop();
				if(_this.workers[next]){
					len--;
					t--;
					_this.workers[next].postMessage(data.pop());
				}
			}
		}
		return _this;
	};
	_this.callback=function(fun){
		_this.cb = fun;
		if(_this.result){
			_this.cb(_this.result);
		}
		return _this;
	};
	_this.fetch=function(){
		_this.reducer.postMessage(["get"]);
		return _this;
	};
	_this.close = function(){
		_this.workers.forEach(function(w){
			w.terminate();
		});
		_this.reducer.postMessage(["close"]);
		return _this;
	};
	return _this;
}
