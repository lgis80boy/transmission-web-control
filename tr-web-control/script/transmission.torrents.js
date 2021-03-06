// 种子相关信息
transmission.torrents = {
	all:null
	,puased:null
	,downloading:null
	,actively:null
	,searchResult:null
	,error:null
	,warning:null
	,folders:{}
	,status:{}
	,count:0
	,totalSize:0
	,loadSimpleInfo:false
	,activeTorrentCount:0
	,pausedTorrentCount:0
	,fields:{
		base:"id,name,status,hashString,totalSize,percentDone,addedDate,trackerStats,leftUntilDone,rateDownload,rateUpload,recheckProgress"
				+",rateDownload,rateUpload,peersGettingFromUs,peersSendingToUs,uploadRatio,uploadedEver,downloadedEver,downloadDir,error,errorString,doneDate,queuePosition"
		,status:"id,status,percentDone,trackerStats,leftUntilDone,rateDownload,rateUpload"
					+",rateDownload,rateUpload,peersGettingFromUs,peersSendingToUs,uploadRatio,uploadedEver,downloadedEver,error,errorString,doneDate,queuePosition"
		,config:"downloadLimit,downloadLimited,peer-limit,seedIdleLimit,seedIdleMode,seedRatioLimit,seedRatioMode,uploadLimit,uploadLimited"
	}
	// 所有已获取的种子列表
	,datas:{}
	// 当前获取的种子列表
	,recently:null
	// 当前移除的种子
	,removed:null
	// 是否正在获取有变化的种子
	,isRecentlyActive:false
	// 新增的种子
	,newIds:new Array()
	,getallids:function(callback,ids)
	{
		var fields = this.fields.base;
		if (this.loadSimpleInfo&&this.all)
			fields = this.fields.status;
		var arguments = {
			fields:fields.split(",")
		};
		this.isRecentlyActive = false;
		// 如果已经获取过
		if (this.all&&ids==undefined)
		{
			arguments["ids"] = "recently-active";
			this.isRecentlyActive = true;
		}
		else if (ids)
		{
			arguments["ids"] = ids;
		}
		if (!this.all)
		{
			this.all = {};
		}
		transmission.exec
		(
			{
				method:"torrent-get"
				,arguments:arguments
			}
			,function(data)
			{
				if (data.result=="success")
				{
					transmission.torrents.newIds.length = 0;
					transmission.torrents.loadSimpleInfo = true;
					transmission.torrents.recently = data.arguments.torrents;
					transmission.torrents.removed = data.arguments.removed;
					transmission.torrents.splitid();
					if (callback)
					{
						callback(data.arguments.torrents);
					}
				}
				else
				{
					transmission.torrents.datas = null;
					if (callback)
					{
						callback(null);
					}
				}
					
			}
		);
	}
	// 根据种子状态将ID进行分类
	,splitid:function()
	{
		// 正在下载的种子
		this.downloading = new Array();
		// 已暂停的种子
		this.puased = new Array();
		// 当前活动的种子
		this.actively = new Array();
		// 有错误提示的种子
		this.error = new Array();
		// 有警告提示的种子
		this.warning = new Array();
		// 所有下载目录列表
		transmission.downloadDirs = new Array();

		var _Status = transmission._status;
		this.status = {};
		transmission.trackers = {};
		this.totalSize=0;
		this.folders = {};
		this.count = 0;

		var B64 = new Base64();

		// 合并两个数
		for (var index in this.recently)
		{
			var item = this.recently[index];
			this.datas[item.id] = item;
		}

		var removed = new Array();

		// 去除已经被删除的种子
		for (var index in this.removed)
		{
			var item = this.removed[index];
			removed.push(item);
		}

		// 将种子进行分类
		for (var index in this.datas)
		{
			var item = this.datas[index];
			if (!item)
			{
				return;
			}
			if ($.inArray(item.id,removed)!=-1&&removed.length>0)
			{
				if (this.all[item.id])
				{
					this.all[item.id] = null;
					delete this.all[item.id];
				}
				this.datas[index] = null;
				delete this.datas[index];
				
				continue;
			}
			// 如果当前是获取正有变化的种子，并且没有在之前种子列表内，即新增的种子，需要重新加载基本的信息
			if (this.isRecentlyActive&&!this.all[item.id])
			{
				this.newIds.push(item.id);
			}
			item = $.extend(this.all[item.id], item);
			if (item.uploadedEver==0&&item.downloadedEver==0)
			{
				item.uploadRatio = "∞";
			}
			item.infoIsLoading = false;
			var type = this.status[item.status];
			this.addTracker(item);
			if (!type)
			{
				this.status[item.status] = new Array();
				type = this.status[item.status];
			}
			
			// 剩余时间
			if (item.rateDownload>0&&item.leftUntilDone>0)
			{
				item["remainingTime"] = getTotalTime(item.leftUntilDone/item.rateDownload*1000);
			}
			else if (item.rateDownload==0&&item.leftUntilDone==0)
			{
				item["remainingTime"] = 0;
			}
			else
				item["remainingTime"] = "∞";
			

			type.push(item);
			// 发生错误的种子
			if (item.error!=0)
			{
				this.error.push(item);
			}
			
			// 当前有流量的种子
			if (item.rateUpload>0||item.rateDownload>0)
			{
				this.actively.push(item);
			}

			switch (item.status)
			{
			case _Status.stopped:
				this.puased.push(item);
				break;

			case _Status.download:
				this.downloading.push(item);
				break;
			}
			
			this.all[item.id]=item;
			
			this.totalSize+=item.totalSize;

			// 设置目录
			if ($.inArray(item.downloadDir, transmission.downloadDirs)==-1)
			{
				transmission.downloadDirs.push(item.downloadDir);
			}

			if (transmission.options.getFolders)
			{
				if (item.downloadDir)
				{
					var folder = item.downloadDir.split("/");
					var folderkey = "folders-";
					for (var i in folder)
					{
						var text = folder[i]; 
						if (text=="")
						{
							continue;
						}
						folderkey += B64.encode(text);
						var node = this.folders[folderkey];
						if (!node)
						{
							node = {count:0,torrents:new Array(),size:0,nodeid:folderkey};
						}
						node.torrents.push(item);
						node.count++;
						node.size+=item.totalSize;
						this.folders[folderkey] = node;
					}
				}
			}
			
			this.count++;

		}
		transmission.downloadDirs = transmission.downloadDirs.sort();

		// 是否有需要获取的新种子
		if (this.newIds.length>0)
		{
			this.getallids(null,this.newIds);
		}
	}
	,addTracker:function(item)
	{
		var trackerStats = item.trackerStats;
		var haveWarning= false;
		
		item.leecherCount = 0;
		item.seederCount = 0;
		if (trackerStats.length>0)
		{
			for (var index in trackerStats)
			{
				var trackerInfo = trackerStats[index];
				var lastResult = trackerInfo.lastAnnounceResult.toLowerCase();
				var trackerUrl = (trackerInfo.host.replace("http://","").replace("https://","").split(":")[0]).split(".");
				if ($.inArray(trackerUrl[0],"www,tracker".split(","))!=-1)
				{
					trackerUrl.shift();
				}
				
				var name = trackerUrl.join(".");
				var id = "tracker-"+name.replace(/\./g,"-");
				var tracker = transmission.trackers[id];
				if (!tracker)
				{
					transmission.trackers[id] = {count:0,torrents:new Array(),size:0,connected:true};
					tracker = transmission.trackers[id];
				}
				
				tracker["name"] = name;
				tracker["nodeid"] = id;
				tracker["host"] = trackerInfo.host;
				
				if (lastResult!="success"&&trackerInfo.announceState!=0)
				{
					haveWarning = true;
					item["warning"] = trackerInfo.lastAnnounceResult;
					
					if (lastResult=="could not connect to tracker")
					{
						tracker.connected = false;
					}
				}
				
				tracker.torrents.push(item);
				tracker.count++;
				tracker.size+=item.totalSize;
				item.leecherCount+=trackerInfo.leecherCount;
				item.seederCount+=trackerInfo.seederCount;
			}
			if (haveWarning)
			{
				// 设置下次更新时间
				if (!item["nextAnnounceTime"])
					item["nextAnnounceTime"] = trackerInfo.nextAnnounceTime;
				else if (item["nextAnnounceTime"] > trackerInfo.nextAnnounceTime)
					item["nextAnnounceTime"] = trackerInfo.nextAnnounceTime;
					
				this.warning.push(item);
			}
			
			if (item.leecherCount<0) item.leecherCount = 0;
			if (item.seederCount<0) item.seederCount = 0;
			
			//item.leecher = item.leecherCount+" | "+item.peersGettingFromUs;
			//item.seeder = item.seederCount+" | "+item.peersSendingToUs;
			item.leecher = item.leecherCount+" ("+item.peersGettingFromUs+")";
			item.seeder = item.seederCount+" ("+item.peersSendingToUs+")";
		}
	}
	// 获取下载者和做种者数量测试
	,getPeers:function(ids){
		transmission.exec
		(
			{
				method:"torrent-get"
				,arguments:{
					fields:("peers,peersFrom").split(",")
					,ids:ids
				}
			}
			,function(data)
			{
				console.log("data:",data);
			}
		);
	}
	// 获取更多信息
	,getMoreInfos:function(fields,ids,callback)
	{
		transmission.exec
		(
			{
				method:"torrent-get"
				,arguments:{
					fields:fields.split(",")
					,ids:ids
				}
			}
			,function(data)
			{
				if (data.result=="success")
				{
					if (callback)
						callback(data.arguments.torrents);
				}
				else if (callback)
					callback(null);
			}
		);
	}
	// 从当前已获取的种子列表中搜索指定关键的种子
	,search:function(key,source)
	{
		if (!key)
		{
			return null;
		}

		if (!source)
		{
			source = this.all;
		}

		var arrReturn = new Array();
		$.each(source, function(item,i){
			if (source[item].name.toLowerCase().indexOf(key.toLowerCase())!=-1)
			{
				arrReturn.push(source[item]);
			}
		});

		this.searchResult = arrReturn;

		return arrReturn;
	}
	// 获取指定种子的文件列表
	,getFiles:function(id,callback)
	{
		transmission.exec
		(
			{
				method:"torrent-get"
				,arguments:{
					fields:("files,fileStats").split(",")
					,ids:id
				}
			}
			,function(data)
			{
				if (data.result=="success")
				{
					if (callback)
						callback(data.arguments.torrents);
				}
				else if (callback)
					callback(null);
			}
		);
	}
	// 获取指定种子的设置信息
	,getConfig:function(id,callback)
	{
		this.getMoreInfos(this.fields.config,id,callback);
	}
	// 获取错误/警告的ID列表
	,getErrorIds:function(ignore,needUpdateOnly)
	{
		var result = new Array();
		var now = new Date();
		if (needUpdateOnly==true)
		{
			now = now.getTime() / 1000;
		}
		for (var index in this.error)
		{
			var item = this.error[index];
			if ($.inArray(item.id,ignore)!=-1&&ignore.length>0)
			{
				continue;
			}
			if (needUpdateOnly==true)
			{
				// 当前时间没有超过“下次更新时间”时，不需要更新
				if (now<item.nextAnnounceTime)
				{
					continue;
				}
			}

			// 已停止的種子不計算在內
			if (item.status==transmission._status.stopped)
			{
				continue;
			}

			result.push(item.id);
		}

		for (var index in this.warning)
		{
			var item = this.warning[index];
			if ($.inArray(item.id,ignore)!=-1&&ignore.length>0)
			{
				continue;
			}
			
			if (needUpdateOnly==true)
			{
				// 当前时间没有超过“下次更新时间”时，不需要更新
				if (now<item.nextAnnounceTime)
				{
					continue;
				}
			}
			result.push(item.id);
		}

		return result;
	}
	// 查找并替換 Tracker
	,searchAndReplaceTrackers:function(oldTracker,newTracker,callback)
	{
		if (!oldTracker||!newTracker)
		{
			return;
		}
		var result = {};
		var count = 0;
		for (var index in this.all)
		{
			var item = this.all[index];
			if (!item)
			{
				return;
			}
			var trackerStats = item.trackerStats;
			for (var n in trackerStats)
			{
				var tracker = trackerStats[n];
				if (tracker.announce==oldTracker)
				{
					if (!result[n])
					{
						result[n] = {ids:new Array(),tracker:newTracker};
					}
					result[n].ids.push(item.id);
					count++;
				}
			}
		}

		if (count==0)
		{
			if (callback)
			{
				callback(null,0);
			}
		}
		for (var index in result)
		{
			transmission.exec({
					method:"torrent-set"
					,arguments:{
						ids:result[index].ids
						,trackerReplace:[parseInt(index),result[index].tracker]
					}
				}
				,function(data,tags){
					if (data.result=="success")
					{
						if (callback)
						{
							callback(tags,count);
						}
					}
					else
					{
						if (callback)
						{
							callback(null);
						}
					}
				}
				,result[index].ids
			);
		}
	}
};