function openTab(evt, tabName) {
    let tabcontent = $(".tabcontent");
    let tablinks = $(".tablinks");

    // close all tabs except for the selected tab
    tabcontent.not(`#${tabName}`).slideUp("fast");

    // toggle the selected tab
    $(`#${tabName}`).slideToggle("fast", function () {
        // after the animation completes, remove "active" class from all tab links
        tablinks.removeClass("active");
    });

    // add "active" class to the selected tab link
    $(evt.currentTarget).toggleClass("active");
}