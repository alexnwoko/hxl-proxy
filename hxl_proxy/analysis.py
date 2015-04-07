import operator
import urllib

from hxl.model import TagPattern
from hxl.io import HXLReader
from hxl.filters.cache import CacheFilter
from hxl.filters.select import SelectFilter, Query

from hxl_proxy.util import norm, make_input

class Analysis:

    TAGS = [
        [
            ('#org', 'organisations')
        ],
        [
            ('#region', 'geographical regions'),
            ('#country', 'countries'),
            ('#adm1', 'level one subdivisions'),
            ('#adm2', 'level two subdivisions'),
            ('#adm3', 'level three subdivisions'),
            ('#adm4', 'level four subdivisions'),
            ('#adm5', 'level five subdivisions')
        ],
        [
            ('#sector', 'sectors'),
            ('#subsector', 'subsectors')
        ]
    ]

    def __init__(self, args):
        self.args = args
        self._saved_source = None
        self._saved_filters = None

    def get_value_counts(self, pattern):
        """Get a list of values and frequencies for a tag pattern."""
        total = 0
        occurs = {}
        for row in self.source:
            values = row.get_all(pattern)
            for value in values:
                key = norm(value)
                if value:
                    total += 1
                    if occurs.get(key):
                        occurs[key]['count'] += 1
                    else:
                        occurs[key] = { 'count': 1, 'orig': value }
        return [ { 'value': key, 'orig': occurs[key]['orig'], 'count': occurs[key]['count'], 'percentage': float(occurs[key]['count']) / total } for key in occurs ]

    def get_top_values(self, pattern):
        return sorted(self.get_value_counts(pattern), key = lambda entry: entry['count'], reverse=True)

    def make_query(self, pattern=None, value=None):
        """Construct a query string"""
        queries = [ [ urllib.quote(str(filter['pattern'])[1:]), urllib.quote(filter['value']) ] for filter in self.filters]
        if pattern:
            queries.append([ urllib.quote(str(pattern)[1:]), urllib.quote(value) ])
        queries.append([ urllib.quote('url'), urllib.quote(self.args.get('url')) ])
        return '&'.join(map(lambda item: '='.join(item), queries))

    @property
    def title(self, tag_pattern=None):
        if tag_pattern:
            return "List of " + str(tag_pattern)
        else:
            who = self.who
            what = self.what
            where = self.where
            if who and what and where:
                return 'What is {} doing for {} in {}?'.format(who, what, where)
            elif who and what:
                return 'Where is {} working in {}?'.format(who, what)
            elif who and where:
                return 'What is {} doing in {}?'.format(who, where)
            elif what and where:
                return 'Who is working on {} in {}?'.format(what, where)
            elif who:
                return 'What is {} working on, where?'.format(who)
            elif what:
                return 'Who is working on {}, where?'.format(what)
            elif where:
                return 'Who is doing what in {}?'.format(where)
            else:
                return 'Who is doing what, where?'

    @property
    def who(self):
        for filter in self.filters:
            if filter['pattern'].tag == '#org':
                return filter['value']
        return None

    @property
    def what(self):
        for filter in self.filters:
            if filter['pattern'].tag in ('#sector', '#subsector'):
                return filter['value']
        return None

    @property
    def where(self):
        for filter in self.filters:
            if filter['pattern'].tag in ('#region', '#country', '#adm1', '#adm2', '#adm3', '#adm4', '#adm5', '#loc'):
                return filter['value']
        return None

    def overview_url(self, pattern=None, value=None):
        return '/analysis?{}'.format(self.make_query(pattern, value))

    def tag_url(self, tag_pattern, pattern=None, value=None):
        return '/analysis/{}?{}'.format(urllib.quote(str(tag_pattern)[1:]), self.make_query(pattern, value))

    @property
    def patterns(self):
        patterns = []
        for tag_list in self.TAGS:
            for tag_info in tag_list:
                pattern = TagPattern.parse(tag_info[0])
                if (pattern.tag not in [filter['pattern'].tag for filter in self.filters]) and (pattern.tag in [column.tag for column in self.source.columns]):
                    patterns.append(tag_info)
                    break
        return patterns

    @property
    def filters(self):
        if self._saved_filters is None:
            filters = []
            for pattern in self.args.to_dict():
                if pattern == 'url':
                    continue
                filters.append({
                    'pattern': TagPattern.parse(pattern),
                    'value': self.args.get(pattern).encode('utf8')
                })
            self._saved_filters = filters
        return self._saved_filters

    @property
    def source(self):
        """Open the input on initial request."""
        if not self._saved_source:
            source = HXLReader(make_input(self.args.get('url')))
            for filter_data in self.filters:
                query = Query(filter_data['pattern'], operator.eq, filter_data['value'])
                source = SelectFilter(source, queries=[query])
            self._saved_source = CacheFilter(source)
        return self._saved_source

