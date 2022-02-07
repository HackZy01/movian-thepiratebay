/**
 * ThePirateBay plugin for Showtime
 *
 *  Copyright (C) 2014-2016 Wain, 2022 fix by BitZy
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

(function (plugin) {
    var config = {
        pluginInfo: plugin.getDescriptor(),
        prefix: plugin.getDescriptor().id,
        logo: plugin.path + "logo.png"
    };

    var service = plugin.createService(config.pluginInfo.title, config.prefix + ":start", "video", true, config.logo);
    var settings = plugin.createSettings(config.pluginInfo.title, config.logo, config.pluginInfo.synopsis);
    var html = require('showtime/html');
    settings.createInfo("info", config.logo, "Plugin developed by " + config.pluginInfo.author + ". \n");
    settings.createDivider('Settings');
    settings.createString("domain", "Domain", "https://thepiratebay3.to", function (v) {
        service.domain = v;
    });
    var nextUrlsRe = /<a href="([\s\w\/]*?)"><img[\s\S]{0,70}?alt="Next"\/?><\/a>/m;

    config.urls = {
        base: service.domain
    };


    function setPageHeader(page, title) {
        if (page.metadata) {
            page.metadata.title = title;
            page.metadata.logo = config.logo;
        }
        page.type = "directory";
        page.contents = "items";
        page.loading = false;
    }

    plugin.addURI(config.prefix + ":start", function (page) {
        //Pages: browse, recent, tv shows, Music, Top 100
        var pages = [
                {
                    url: '/browse',
                    name: 'Browse'
                },
                {
                    url: '/recent',
                    name: 'Recent'
                },
                {
                    url: '/browse/205',
                    name: 'TV Shows'
                },
                {
                    url: '/browse/201',
                    name: 'Movies'
                },
                {
                    url: '/browse/101',
                    name: 'Music'
                },
                {
                    url: '/top/all',
                    name: 'Top 100'
                }
            ],
            i, length = pages.length;
        setPageHeader(page, config.pluginInfo.synopsis);
        for (i = 0; i < length; i++) {
            page.appendItem(config.prefix + ":category:" + pages[i].url + ':' + encodeURIComponent(pages[i].name), "directory", {
                title: pages[i].name
            });
        }
    });


    plugin.addURI(config.prefix + ":category:(.*):(.*)", function (page, url, name) {
        var dom, doc, items, i,
            link, linkUrl, linkTitle,
            nextUrl, prefix,
            tryToSearch = true;
        setPageHeader(page, decodeURIComponent(name));
        url = config.urls.base + decodeURIComponent(url);

        page.paginator = loader;
        loader();

        function loader() {
            if (!tryToSearch) {
                return false;
            }

            page.loading = true;
            doc = showtime.httpReq(url).toString();
            dom = html.parse(doc);
            page.loading = false;


            items = dom.root.getElementById('categoriesTable');
            if (items) {
                items = items.getElementByTagName('a');
                prefix = 'category';
                for (i = 0; i < items.length; i++) {
                    link = items[i];
                    linkUrl = items[i].attributes.getNamedItem('href').value;
                    linkTitle = items[i].textContent;
                    page.appendItem(config.prefix + ":category:" + encodeURIComponent(linkUrl) + ':' + encodeURIComponent(linkTitle), "directory", {
                        title: items[i].textContent
                    });
                }
            }
            else {
                items = dom.root.getElementById('searchResult');
                if (items) {
                    items = items.getElementByClassName('detName');
                    for (i = 0; i < items.length; i++) {
                        link = items[i].getElementByTagName('a')[0];
                        linkUrl = link.attributes.getNamedItem('href').value;
                        linkTitle = link.textContent;
                        page.appendItem(config.prefix + ":torrent:" + encodeURIComponent(linkUrl) + ':' + encodeURIComponent(linkTitle), "directory", {
                            title: linkTitle
                        });
                    }
                }
                else {
                    return tryToSearch = false;
                }
            }

            nextUrl = nextUrlsRe.exec(doc);
            if (!nextUrl) {
                return tryToSearch = false;
            }

            url = config.urls.base + nextUrl[1];
            return true;
        }
    });

    plugin.addURI(config.prefix + ":torrent:(.*):(.*)", function (page, url, name) {
        var dom, magnetUrl, torrentDescription;
        name = decodeURIComponent(name);
        setPageHeader(page, name);
        page.loading = true;
        dom = html.parse(showtime.httpReq(config.urls.base + decodeURIComponent(url)).toString());
        page.loading = false;

        magnetUrl = dom.root.getElementByClassName('download')[0].getElementByTagName('a')[0].attributes.getNamedItem('href').value;
        torrentDescription = dom.root.getElementByClassName('nfo')[0].textContent;
        page.appendItem("torrent:browse:" + magnetUrl, "directory", {
            title: 'magnet: ' + name,
            description: torrentDescription
        });
    });

    plugin.addSearcher(plugin.getDescriptor().id, config.logo, function (page, query) {
        //Example URL: https://thepiratebay.se/search/one/0/99/0
        var url = config.urls.base + '/search/' + encodeURIComponent(query) + '/0/99/0',
            nextUrl, tryToSearch = true, i,
            doc, dom, link, linkUrl, linkTitle, items;

        page.entries = 0;
        loader();
        page.paginator = loader;

        function loader() {
            if (!tryToSearch) {
                return false;
            }

            page.loading = true;
            doc = showtime.httpReq(url).toString();
            dom = html.parse(doc);
            page.loading = false;

            items = dom.root.getElementById('searchResult');
            if (items) {
                items = items.getElementByClassName('detName');
                for (i = 0; i < items.length; i++) {
                    link = items[i].getElementByTagName('a')[0];
                    linkUrl = link.attributes.getNamedItem('href').value;
                    linkTitle = link.textContent;
                    page.appendItem(config.prefix + ":torrent:" + encodeURIComponent(linkUrl) + ':' + encodeURIComponent(linkTitle), "directory", {
                        title: linkTitle
                    });
                    page.entries++;
                }
            }
            else {
                return tryToSearch = false;
            }

            nextUrl = nextUrlsRe.exec(doc);
            if (!nextUrl) {
                return tryToSearch = false;
            }

            url = config.urls.base + nextUrl[1];
            return true;
        }
    });
})(this);
