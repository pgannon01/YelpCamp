const Campground = require("../models/campground");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");

module.exports.index = async (req, res) => { // Show All Campgrounds
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds });
};

module.exports.renderNewForm = (req, res) => { // Form to create a new campground
    res.render("campgrounds/new");
};

module.exports.createCampground = async (req, res, next) => { // Post request to create a new campground and save it to the database
    // if(!req.body.campground) throw new ExpressError("Invalid Campground Data", 400);
    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send();
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.body.features[0].geometry;
    campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.author = req.user._id;
    await campground.save();
    console.log(campground);
    req.flash("success", "Successfully made a new campground!");
    res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.showCampground = async (req, res) => { // Show One Campground
    const campground = await Campground.findById(req.params.id).populate({
        path: "reviews", 
        populate: { 
            path: "author"
        }
    }).populate("author");
    if(!campground) {
        req.flash("error", "Sorry, I cannot find that campground!");
        return res.redirect("/campgrounds");
    };
    res.render("campgrounds/show", { campground });
};

module.exports.renderEditForm = async (req, res) => { // Edit one campground form
    const { id } = req.params
    const campground = await Campground.findById(id);
    if(!campground) {
        req.flash("error", "Sorry, I cannot find that campground!");
        return res.redirect("/campgrounds");
    };
    res.render("campgrounds/edit", { campground });
};

module.exports.updateCampground = async (req, res) => { // PUT method for editing campground, will change all data in the campground
    const { id } = req.params;
    const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground });
    const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.images.push(...imgs);
    await campground.save();
    if(req.body.deleteImages) {
        for(let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
    }
    req.flash("success", "Successfully updated campground!");
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.deleteCampground = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findByIdAndDelete(id);
    req.flash("success", "Successfully deleted campground");
    res.redirect("/campgrounds");
};