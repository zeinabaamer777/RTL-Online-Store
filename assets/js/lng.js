
$(function () {
    function checkForLanguage(selector) {
        var $this = $(selector);
        if ($this.val() === "en") { // English
          //Add Attribute Selected 
            $this.find("option[value='en']")
                .attr("selected","selected")
                .siblings().removeAttr("selected");
            //Change Direction
            $('link[href="assets/css/styleRtl.css"]').attr('href','assets/css/style.css');
            $("html").attr("dir","ltr");
        } else if ($this.val() === "ar") { //Arabic
            //Add Attribute Selected 
            $this.find("option[value='ar']")
                .attr("selected","selected")
                .siblings().removeAttr("selected");
            //Change Direction
            $('link[href="assets/css/style.css"]').attr('href','assets/css/styleRtl.css');
            $("html").attr("dir","rtl");
           
        }

    }
    //Called Function Onload
    checkForLanguage("select");
    //when choose language
    $("select").on("change", function () {
        checkForLanguage($(this));
    });  
});