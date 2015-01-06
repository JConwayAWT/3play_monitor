var isTurnedOn = -1;
var refresherID = 0;
var badgeTextInterval = 0;
var currentID = 0;
var firstRefresh = true;
var currentWindowID = 0;
var jobs_url = "http://jobs.3playmedia.com/available_jobs";

chrome.browserAction.onClicked.addListener(function(tab){

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){

        if (tabs[0].url != jobs_url && isTurnedOn == 1){
            //turn it off
            isTurnedOn = -1;
            tellThemWeStopped();
            updateIcon(isTurnedOn);
            clearInterval(refresherID);
        }

        else{
            isTurnedOn = isTurnedOn*-1
            updateIcon(isTurnedOn);
            firstRefresh = true;

            if (isTurnedOn == 1)
            {

                tellThemWeStarted();

                oldIndividualDOM = null;
                oldGroupedDOM = null;

                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

                    if (tabs.length == 0) {
                        return;
                    }

                    currentID = tabs[0].id;

                    $.ajax({
                        url: 'https://jobs.3playmedia.com/user/sessions',
                        type: 'POST',
                        data: {
                            user_session: {
                                email: "user@domain.com", password: "yourpassword123"
                            }
                        },
                    })
                    .done(function() {
                        chrome.tabs.update(currentID,{url: jobs_url});
                    });

                    startTimerDisplayFromThirty();
                    refresherID = setInterval(function() {

                        chrome.tabs.reload(currentID, { bypassCache: true }, function() {

                            stopTimerDisplayCompletely();
                            startTimerDisplayFromThirty();
                            chrome.tabs.executeScript(currentID, {
                                file:      'inject.js',
                                runAt:     'document_idle',
                                allFrames: false
                            }, function(results) {

                                //result will be [indies, grouped]
                                if (chrome.runtime.lastError) {
                                    console.log('3Play Market Watch Error:\n' + chrome.runtime.lastError.message);
                                    return;
                                } else if (results.length == 0) {
                                    console.log('3Play Market Watch Error: No results!');
                                    return;
                                }

                                newIndividualDOM = $(results[0][0]);
                                newGroupedDOM = $(results[0][1]);


                                if (($(newIndividualDOM).text() == $(oldIndividualDOM).text()) && ($(newGroupedDOM).text() == $(oldGroupedDOM).text())){
                                    oldIndividualDOM = newIndividualDOM;
                                    oldGroupedDOM = newGroupedDOM;
                                }
                                else if (firstRefresh){
                                    firstRefresh = false;

                                    checkForJobsOnFirstRefresh(newIndividualDOM,newGroupedDOM);

                                    oldIndividualDOM = newIndividualDOM;
                                    oldGroupedDOM = newGroupedDOM;
                                }
                                else{
                                    var opt = {
                                        type: "basic",
                                        title: "3Play Changes",
                                        message: throwUpdateMessage(newIndividualDOM,newGroupedDOM),
                                        iconUrl: "medium_icon.png"
                                    }

                                    chrome.notifications.create("1",opt,function(){});

                                    setTimeout(function(){
                                        chrome.notifications.clear("1",function(){});
                                    },2000);

                                    oldIndividualDOM = newIndividualDOM;
                                    oldGroupedDOM = newGroupedDOM;
                                }
                            });
                        });
                    }, 31*1000);
                });
            }
            else{
                tellThemWeStopped();
                updateIcon(isTurnedOn);
                clearInterval(refresherID);
            }
        }
    });
});

//turn it off if they close the tab
chrome.tabs.onRemoved.addListener(function(tabID, removeInfo){
    if(tabID == currentID && isTurnedOn == 1){
        isTurnedOn = -1;
        updateIcon(isTurnedOn);
        clearInterval(refresherID);
        tellThemWeStopped();   
    }
});

//turn it off if they use the tab for another site
chrome.tabs.onUpdated.addListener(function(tabID, changeInfo, tab){
    if(tabID == currentID && isTurnedOn == 1 && tab.url != jobs_url){
        isTurnedOn = -1;
        updateIcon(isTurnedOn);
        clearInterval(refresherID);
        tellThemWeStopped();
    }
});

chrome.tabs.onAttached.addListener(function(tabID, attachInfo){
    if(tabID == currentID && isTurnedOn == 1){
        currentWindowID = attachInfo.newWindowId;
    }
});

chrome.windows.onRemoved.addListener(function(winID){
    if (winID == currentWindowID && isTurnedOn == 1){
        isTurnedOn = -1;
        updateIcon(isTurnedOn);
        clearInterval(refresherID);
        tellThemWeStopped();
    }
});

function throwUpdateMessage(indy, group){
    obviousIndyJobs = $(indy).find("tbody").children().length;
    obviousGroupJobs = $(group).find("tbody").children().length;

    if ($(indy).first().hasClass("pagination")){
        obviousIndyJobs = (parseInt($(indy).first().children().last().prev().text()) - 1) * 7;
        obviousIndyJobs = obviousIndyJobs + "+"
    }

    if ($(group).first().hasClass("pagination")){
        obviousGroupJobs = (parseInt($(group).first().children().last().prev().text()) - 1) * 7;
        obviousGroupJobs = obviousGroupJobs + "+"
    }

    if (parseInt(obviousIndyJobs) > 0){
        indyTotalAmount = totalAmount(indy);
        indyAverageRate = averageRate(indy, indyTotalAmount);
    }

    if (parseInt(obviousGroupJobs) > 0){
        groupTotalAmount = totalAmount(group);   
        groupAverageRate = averageRate(group, groupTotalAmount);
    }

    if (parseInt(obviousIndyJobs) == 0 && parseInt(obviousGroupJobs) == 0){
        var opt = {
            type: "basic",
            title: "All Jobs Cleared",
            message: "There are no jobs available in the market",
            iconUrl: "medium_icon.png"
        }
        chrome.notifications.create("jobsCleared",opt,function(){});
        setTimeout(function(){chrome.notifications.clear("jobsCleared",function(){});},4000);
        audioNotificationDown();
    }
    else if (parseInt(obviousIndyJobs) > 0 && parseInt(obviousGroupJobs) == 0){
        var opt = {
            type: "basic",
            title: "Single Jobs Available",
            message: obviousIndyJobs + " Job(s) || $" + indyTotalAmount + " || Avg $" + indyAverageRate + "/min\r\nMax Adjustment: " + getMaximumAdjustment($(indy)) + "%",
            iconUrl: "medium_icon.png"
        }
        chrome.notifications.create("singleJobs",opt,function(){});
        setTimeout(function(){chrome.notifications.clear("singleJobs",function(){});},4000);
        audioNotificationUp();
    }
    else if (parseInt(obviousGroupJobs) > 0 && parseInt(obviousIndyJobs) == 0){
        var opt = {
            type: "basic",
            title: "Group Jobs Available",
            message: obviousGroupJobs + " Job(s) || $" + groupTotalAmount + " || Avg $" + groupAverageRate + "/min",
            iconUrl: "medium_icon.png"
        }
        chrome.notifications.create("groupJobs",opt,function(){});
        setTimeout(function(){chrome.notifications.clear("groupJobs",function(){});},4000);
        audioNotificationUp();
    }
    else{
        var opt = {
            type: "basic",
            title: "Mixed Jobs Available",
            message: "Single Jobs:\r\n" + obviousIndyJobs + " Job(s) || $" + indyTotalAmount + " || Avg $" + indyAverageRate + "/min"
            + "\r\nGroup Jobs:\r\n" + obviousGroupJobs + " Job(s) || $" + groupTotalAmount + " || Avg $" + groupAverageRate + "/min\r\nMax Adjustment: " + getMaximumAdjustment($(indy)) + "%",
            iconUrl: "medium_icon.png"
        }
        chrome.notifications.create("mixedJobs",opt,function(){});
        setTimeout(function(){chrome.notifications.clear("mixedJobs",function(){});},4500);
        audioNotificationUp();
    }
}

function averageRate(currentHTML, currentAmount){
    totalSeconds = 0;

    var type = "grouped";
    if (currentHTML.find("thead").find("tr").children().length == 13){type = "individual";}

    for (k = 0; k < currentHTML.find("tbody").children().length; k++){
        if (type == "individual"){
            findString = "tbody tr:nth-child(" + (k+1) + ") td:nth-child(6)";
        }
        else{
            findString = "tbody tr:nth-child(" + (k+1) + ") td:nth-child(5)";
        }
        originalTimeString = currentHTML.find(findString).text();
        splitTime = originalTimeString.split(':');
        seconds = (+splitTime[0])*3600 + (+splitTime[1])*60 + (+splitTime[2]);
        totalSeconds += seconds;
    }
    return (currentAmount*60.0/totalSeconds).toFixed(2);
}

function getMaximumAdjustment(currentHTML){
var maximum = 0;

    for (k = 0; k < currentHTML.find("tbody").children().length; k++){
        findBonusString = "tbody tr:nth-child(" + (k+1) + ") td:nth-child(8)";
        findRateString = "tbody tr:nth-child(" + (k+1) + ") td:nth-child(7)";

        bonusString = currentHTML.find(findBonusString).text().trim();
        rateString = currentHTML.find(findRateString).text().trim();
        if (bonusString != ""){
            rate = parseFloat(rateString.substring(1, rateString.length));
            bonus = parseFloat(bonusString.substring(2,bonusString.length-1))/rate;
            if (bonus > maximum) {
                maximum = bonus;
            }
        }
    }
    return parseInt(maximum*100);
}

function totalAmount(currentHTML){
    sum = 0;

    var type = "grouped";
    if (currentHTML.find("thead").find("tr").children().length == 13){
        type = "individual";
    }

    for (k = 0; k < currentHTML.find("tbody").children().length; k++){
        if (type == "individual"){
            findString = "tbody tr:nth-child(" + (k+1) + ") td:nth-child(9)";
        }
        else{
            findString = "tbody tr:nth-child(" + (k+1) + ") td:nth-child(8)";
        }
        amount = currentHTML.find(findString).text();
        amount = parseFloat(amount.substring(1, amount.length));
        sum += amount;
    }
    return sum.toFixed(2);
}

function checkForJobsOnFirstRefresh(indy, group){
    obviousIndyJobs = $(indy).find("tbody").children().length;
    obviousGroupJobs = $(group).find("tbody").children().length;
    if (obviousIndyJobs + obviousGroupJobs > 0){
        throwUpdateMessage(indy,group);
    }
}

function basicJobNumberNotification(n){
    var opt = {
        type: "basic",
        title: "3Play Jobs Available",
        message: "There are " + n + " jobs available in the market",
        iconUrl: "medium_icon.png"}
    chrome.notifications.create("nJobs",opt,function(){});
    setTimeout(function(){chrome.notifications.clear("nJobs",function(){});},2000);
}

function getIndyChangeInformation(newIndy){
    obviousCount = $(".individual_jobs").find("tbody").children().length;

    extraFullPages = 0;

    if ($(".individual_jobs").find(".pagination.individual").html() == null){
        extraFullPages = 0;
    }
    else{
        extraFullPages = $(".individual_jobs").find(".pagination").children().last().prev().prev().text(); //get the second or third to last child's text...
    }

    if (extraFullPages == 0){
        return ["exact", obviousCount];
    }
    else{
        return ["estimate", obviousCount + extraFullPages*5 + 1];
    }
}

function getGroupChangeInformation(newGroup){
    obviousCount = $(".grouped_jobs").find("tbody").children().length;

    //check if it's "grouped"
    if ($(".grouped_jobs").find(".pagination.grouped").html() == null){
        extraFullPages = 0;
    }
    else{
        extraFullPages = $(".grouped_jobs").find(".pagination").children().last().prev().prev().text(); //get the second or third to last child's text...
    }

    if (extraFullPages == 0){
        return ["exact", obviousCount];
    }
    else{
        return ["estimate", obviousCount + extraFullPages*5 + 1];
    }
}

function tellThemWeStarted(){
    var opt = {
        type: "basic",
        title: "3Play Market Watch Initialized",
        message: getStartMessage(),
        iconUrl: "medium_icon.png"
    }
    chrome.notifications.create("2",opt,function(){});
    setTimeout(function(){chrome.notifications.clear("2",function(){});},2000);
}

function tellThemWeStopped(){
    var opt = {
        type: "basic",
        title: "3Play Market Watch Terminated",
        message: getStopMessage(),
        iconUrl: "medium_icon.png"
    }
    chrome.notifications.create("3",opt,function(){});
    setTimeout(function(){chrome.notifications.clear("3",function(){});},2000);
    stopTimerDisplayCompletely();
}

function audioNotificationUp(){
    var pingSound = new Audio('notification_up.mp3');
    pingSound.play();
}

function audioNotificationDown(){
    var pingSound = new Audio('notification_down.mp3');
    pingSound.play();
}

function startTimerDisplayFromThirty(){
    chrome.browserAction.setBadgeText({text: "31"});

    //     the number here should be ONE LESS than the total refresh time
    //     due to the one second interval before the first display.
    timeRemaining = "30"
    badgeTextInterval = setInterval(function(){
        if (parseInt(timeRemaining) > -1){
            chrome.browserAction.setBadgeText({text: timeRemaining});
        }
        timeRemaining = String(parseInt(timeRemaining)-1);
    }, 1*1000);
}

function stopTimerDisplayCompletely(){
    clearInterval(badgeTextInterval);
    chrome.browserAction.setBadgeText({text: ''});
}

function getStartMessage(){
    return "Cool, we'll keep an eye on it for you.";
}

function getStopMessage(){
    return "3Play Market Watch has been closed.";
}


function updateIcon(isTurnedOn){
    if (isTurnedOn == 1){
        //make it the running icon
        chrome.browserAction.setIcon({path: 'icon_while_running.png'});
    }
    else{
        //make it the default icon
        chrome.browserAction.setIcon({path: 'icon.png'});
    }
}

